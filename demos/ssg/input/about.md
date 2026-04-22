# About

`ionpower-node` is a small Node.js-compatible JavaScript runtime for
32-bit PowerPC Mac OS X 10.4 Tiger. It embeds SpiderMonkey 45
(from the TenFourFox tree, which includes the IonPower JIT backend)
and exposes a subset of Node's API surface on top.

## What works

- CommonJS `require` for relative paths and a handful of core modules.
- Synchronous filesystem: `readFileSync`, `writeFileSync`, `existsSync`,
  `readdirSync`, `statSync`, `unlinkSync`.
- `console`, `process`, `path`, `Buffer`.
- Synchronous `setImmediate` / `setTimeout` shims (no event loop).

## What doesn't

- No real async. No event loop. No HTTP.
- No `node_modules` resolution — bare `require('foo')` throws.
- No native addons (N-API).
- Any JS feature newer than ES2016 (optional chaining, nullish
  coalescing, private fields, etc.) fails to parse.

See the [compatibility matrix](../compat.md) for which real libraries
have been verified working.
