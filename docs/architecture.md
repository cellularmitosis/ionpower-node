# ionpower-node architecture

How the runtime is organized, end-to-end.

## Layers

```
+-----------------------------------------------------------+
|  user script: hello.js, require_chain.js, ...             |
+-----------------------------------------------------------+
|  Node-compat bootstrap (JS, compiled in as string)        |
|    builds public fs/path objects from native bindings;    |
|    registers 'fs' and 'path' in the require cache so      |
|    `require('fs')` and `require('path')` work.            |
+-----------------------------------------------------------+
|  Node-compat native bindings (C++, JSAPI)                 |
|    console, process, __fs_native__, __path_native__,      |
|    Buffer, __require_native__, __make_require__.          |
+-----------------------------------------------------------+
|  JSAPI (SpiderMonkey 45 public API)                       |
|    JSRuntime, JSContext, JSAutoCompartment, JS_NewObject, |
|    JS_DefineFunction, JS::Evaluate, JS::Call, ...         |
+-----------------------------------------------------------+
|  SpiderMonkey VM                                          |
|    parser, bytecode interpreter, Baseline JIT, Ion JIT    |
+-----------------------------------------------------------+
|  IonPower (js/src/jit/osxppc/)                            |
|    Assembler-ppc, MacroAssembler-ppc, CodeGenerator-ppc,  |
|    BaselineCompiler-ppc, Lowering-ppc, Trampoline-ppc     |
+-----------------------------------------------------------+
|  powerpc-apple-darwin8 (Tiger / 10.4 / 32-bit PowerPC)    |
+-----------------------------------------------------------+
```

## Startup

`int main(argc, argv)` in `src/main.cpp`:

1. `JS_Init()` — engine-global init. Must run once per process.
2. `JS_NewRuntime(32MB, 2MB)` — match Firefox/Shell defaults.
3. `JS_SetErrorReporter` — print lineno + message to stderr.
4. `JS_SetNativeStackQuota(2MB)` — conservative.
5. `JS_NewContext(rt, 8192)` — 8 KB default stack chunk.
6. `JS_NewGlobalObject` with a minimal global JSClass (no special
   resolve hooks, just `JS_GlobalObjectTraceHook`).
7. `JSAutoCompartment` to enter the new global.
8. `JS_InitStandardClasses` — Math, Array, JSON, etc.
9. `InstallNodeCompatGlobals(cx, global, argc, argv)`:
   - console, process, fs-native, path-native, Buffer, require
     machinery, then evaluate the bootstrap JS that wraps up the
     public `fs`/`path` and seeds the require cache.
10. `JS_FireOnNewGlobalObject`.
11. `RunEntryScript(cx, global, argv[1])`.
12. Tear everything down in reverse.

## CommonJS require

Lives in `src/node_compat/require.cpp`. The JS side is a thin
factory, the C++ side does the real work.

### Cache

`__require_cache__` is a plain object owned by the global. Keys are
absolute filesystem paths (for resolved files) or core module names
(`"fs"`, `"path"`) that the bootstrap seeds. Values are the
`module.exports` of each module.

The JS-level `require` wrapper checks bare names first so
`require('fs')` returns the core module without ever touching the
filesystem.

### Resolution

For a specifier `spec` called from module directory `dir`:

- If `spec` starts with `/`, it is absolute.
- Otherwise `spec` must start with `./` or `../`. Bare specs
  (`'lodash'`) fail with a clear error. No node_modules search.
- Candidate paths, in order: `base`, `base + ".js"`,
  `base + "/index.js"`.
- First matching regular file wins.

### Wrapping

Each module file is wrapped in an IIFE before evaluation:

```js
(function (exports, require, module, __filename, __dirname) {
  <user source>
});
```

SpiderMonkey compiles the wrapper, we call it with real objects.
The `module.exports` assignment pattern works because we read
`module.exports` back after the IIFE returns.

### Circular imports

The cache stores the not-yet-populated `exports` object *before*
the module body runs, so `a.js` requiring `b.js` requiring `a.js`
gets a live (partial) reference to `a`'s exports. Matches Node.

## Native bindings pattern

Each native module follows the same shape:

```cpp
static bool FooBar(JSContext*, unsigned, JS::Value*);    // the impl
static const JSFunctionSpec kFoos[] = {                   // dispatch
    JS_FN("bar", FooBar, 1, 0),
    JS_FS_END
};
bool InstallFoo(JSContext* cx, JS::HandleObject global) {
    JS::RootedObject foo(cx, JS_NewPlainObject(cx));
    if (!foo) return false;
    if (!JS_DefineFunctions(cx, foo, kFoos)) return false;
    return JS_DefineProperty(cx, global, "foo", foo, JSPROP_ENUMERATE);
}
```

`JS::CallArgs args = JS::CallArgsFromVp(argc, vp)` inside each
function; argument access via `args[i]`; coerce with
`JS::ToString`, `JS::ToInt32`, `JS::ToUint32`. Always return `bool`
where `false` means "a JS exception has been thrown via
`JS_ReportError`." Set `args.rval()` before returning `true`.

## Memory and roots

Because SpiderMonkey 45 has a moving GC, every live JSObject*
reference held by C++ stack must be in a `JS::Rooted<T>` /
`JS::RootedObject` / `JS::RootedString` / `JS::RootedValue`. The
bridge code uses these pervasively. Typed-array data is accessed
via `JS::AutoCheckCannotGC` and `JS_GetUint8ArrayData` inside a
no-GC scope.

## Why separate native bindings from public shape

`__fs_native__` is an internal name; the public `fs` object is
built in the JS bootstrap. This gives us room to do everything
real Node does — add higher-level wrappers, normalize error shapes,
add deprecation warnings, etc. — without having to ship a C++ PR
for every tweak.

## What we deliberately didn't build

- **No event loop**, so no async. `setTimeout(fn, 0)` has no
  natural home. Real Node runs its own libuv-driven loop; we'd
  need one too before `http`, `setInterval`, async `fs`, etc. make
  sense. Adding a minimal select()-based loop is a reasonable
  Phase 4.
- **No streams**. `fs.createReadStream` would pull us into
  EventEmitter and back-pressure design. Out of scope for v0.1.
- **No util.format / util.inspect**. `console.log({a:1})` prints
  `[object Object]` today. Cheap to add later (JSON.stringify in
  the console impl for non-string args), but not done yet.
- **No node_modules resolution**. Bare specs throw. We want to
  keep `require` predictable.
- **No ES modules (`import`)**. SpiderMonkey 45's module support
  was experimental and incomplete; CommonJS is simpler and
  sufficient.

## SpiderMonkey, not a JS-shell harness

One reasonable alternative would be "ship the SpiderMonkey `js`
shell, paper over its API with a big JS prelude." We didn't do
that because the shell carries a lot of baggage — fuzz hooks, the
ECMA test runner shape, tracelogger, its own watchdog — and its
CLI surface isn't shaped like Node. Writing a small embedder from
scratch is cheaper and controllable.

We borrowed freely from `js/src/shell/js.cpp` (creating runtime /
context / global, FireOnNewGlobalObject, etc.) and from
`js/src/shell/OSObject.cpp` (reading files, path helpers) — that
code is MPL-2.0 and compatible.
