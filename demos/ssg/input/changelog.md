# Changelog

## v0.1.0 — 2026-04-21

Initial working release.

- SpiderMonkey 45 standalone built from the TenFourFox tree with the
  IonPower 32-bit PowerPC JIT enabled.
- Bridge: `console`, `process`, sync `fs`, `path`, `Buffer`-shim,
  CommonJS `require`, `setImmediate`/`setTimeout` stubs.
- Compatibility confirmed against: marked 4.3.0, acorn 8.11.3,
  handlebars 4.7.8, lodash 4.17.21, TypeScript 3.9.10, semver 5.7.2,
  prettier 1.19.1.
- Build host: imacg52 (G5 2.0 GHz, 10.4.11). Target: any
  `-mcpu={G3,G4,G5}` PowerPC Mac with Tiger.
- JIT speedup measured at 13.7× vs interpreter on a tight integer
  loop.

### Known gaps

- No event loop, so no real async.
- No `node_modules` lookup.
- ES version ceiling: ES2016. Newer syntax (`?.`, `??`, `catch{}`,
  `#fields`, etc.) fails at parse time.
