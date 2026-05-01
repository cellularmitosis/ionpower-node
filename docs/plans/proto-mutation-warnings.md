# Plan: investigate `[[Prototype]]` mutation warnings

## What we're seeing

During `make test-all` on G3/G4/G5, the runtime prints a flood of
SpiderMonkey 45 warnings of the form:

    /Users/macuser/tmp/cell/ionpower-node/test/vendor/babel.js:1:
    mutating the [[Prototype]] of an object will cause your code to
    run very slowly; instead create the object with the correct
    initial [[Prototype]] value using Object.create

The `:1` source location is unhelpful — Babel is one big
single-line bundle, and SM45's source-mapping for these warnings
is "the start of the script that triggered the deopt", not the
actual offending line.

## What triggers the warning

SpiderMonkey 45 emits this whenever JS does:

- `obj.__proto__ = X`
- `Object.setPrototypeOf(obj, X)`
- (Some inheritance patterns that get compiled to one of the above
  — including class extension if the prototype gets re-pointed
  after creation.)

It's a real perf concern: SM has to invalidate type information
for every property on `obj` and any object that ever had a
prototype-chain dependency on it. Each warning corresponds to a
discrete deopt; many warnings = many cache invalidations.

## Where it's coming from — investigate

Need to find each unique call-site. The warning line number is
useless; SM45 prints the script's first line. We need to either:

1. **Patch the runtime** to print a real stack trace alongside the
   warning. The warning emit happens deep in SM's `obj.cpp` (or
   wherever `JSObject::setProto` lives). Could intercept via the
   error reporter / warning callback and capture
   `JS::CaptureCurrentStack` before printing.

2. **Bisect**: temporarily comment out chunks of `kBootstrapJS`
   and re-run a smoke. Whichever chunk's removal silences the
   warnings is the culprit.

3. **Grep for likely patterns** in our own code first:
   - `__proto__ =`
   - `setPrototypeOf(`
   - `util.inherits` (our impl uses
     `Object.create(superCtor.prototype, ...)` which is the
     *right* way — should not trigger)
   - manual prototype splicing for instanceof tricks

   We touched a few of these in v0.83 / v0.84:
   - `Object.defineProperty(process, Symbol.toStringTag, ...)` —
     defines a property, doesn't mutate proto.
   - `util.inherits(_Readable, _Stream)` etc. — uses
     `Object.create`, should be fine.

   Most likely culprits in our code:
   - Any place where we attach methods to a prototype that was
     then later reassigned.
   - Our `Promise` polyfill (line numbering near 4400 of
     `globals.cpp`) does some prototype work.
   - Buffer bootstrap promotes Buffer from object → function and
     re-points `Buffer.prototype` to `Uint8Array.prototype` —
     that's a clear `[[Prototype]]` mutation. Check `buffer.cpp`.

4. **Check third-party code**:
   - `test/vendor/babel.js` itself uses prototype mutation in its
     internals (it has to — it's a JS compiler).
   - `node-fetch` does `Object.setPrototypeOf({...}, ...)` for
     its `HeadersIteratorPrototype` (line 956, confirmed during
     v0.84 work).
   - `axios`, `elliptic`, `node-forge`, etc. likely too.

## Plan

1. Add a temporary console.trace shim that prints when a
   `[[Prototype]]` warning fires — patch SM45 source if needed,
   or wrap the warning callback at the C++ level. Goal: get a
   real stack frame for each unique warning site.

2. Bucket the stack frames by origin:
   - "ionpower-node bootstrap" → ours, fix
   - `test/vendor/<pkg>/...` → third-party, leave alone (note in
     a known-deopt list)

3. For each "ours" entry, refactor to use `Object.create(proto)`
   at construction time rather than mutating after.

4. Re-run `make test-all` and confirm warning count drops.

## Cost / value

Cost: maybe a half-day session, probably less if the bulk of
warnings are from one or two of our shims.

Value: every `[[Prototype]]` mutation deopts the JIT for every
property accessor on the affected chain. On a G3 this matters more
than on modern hardware. If we have, say, three offenders inside
hot paths (Promise / Buffer / something in stream), removing them
could measurably speed up smokes.

## Done when

- One pass over our shims with all `[[Prototype]]`-mutation
  patterns either justified (third-party) or eliminated.
- `make test-all` warning count down to "third-party only".
- A `docs/perf/proto-mutation-deopts.md` write-up listing which
  vendored libs still trigger the warning + why we accept it.
