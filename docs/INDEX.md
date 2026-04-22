# Documentation index

Reading order for someone picking this project up cold.

| If you want to… | Read |
|---|---|
| Understand the project goals and scope | [plan.md](plan.md) |
| Understand the runtime architecture | [architecture.md](architecture.md) |
| Understand the IonPower JIT we're reusing | [ionpower-overview.md](ionpower-overview.md) |
| Build SpiderMonkey from scratch on a Tiger host | [setup.md](setup.md) |
| See what went wrong and how it was fixed during the actual build | [build-notes.md](build-notes.md) |
| Know what to do after the SpiderMonkey build finishes | [post-build-checklist.md](post-build-checklist.md) |
| Triage a build or link failure | [fallback-plans.md](fallback-plans.md) |
| See the current state of the project | [status-report.md](status-report.md) |
| See what the parallel session B contributed | [status-report-session-B.md](status-report-session-B.md) |

File map:

```
Makefile                             -- target-host build: make && ./ionpower-node test/hello.js
README.md                            -- project overview
docs/                                -- everything above
external/tenfourfox/                 -- sparse checkout of TenFourFox (source of truth for JIT)
scripts/
  build-autoconf-213.sh              -- prereq: autoconf 2.13 → /opt/autoconf-2.13
  build-mozjs.sh                     -- build SpiderMonkey from TenFourFox source on a Tiger host
  install-mozjs-45-ionpower-g5.sh    -- tiger.sh-style packaging wrapper around build-mozjs.sh
  deploy-and-test.sh                 -- rsync + make + run all smoke tests on imacg52
src/
  main.cpp                           -- runtime entry point: JS_Init, runtime, global, run
  node_compat/
    globals.{h,cpp}                  -- install/wire all subsystems onto the global
    console.cpp                      -- console.log/error/warn/info/debug
    process.cpp                      -- process.{argv,env,platform,arch,version,pid,cwd,exit}
    fs.cpp                           -- fs.{readFileSync,writeFileSync,statSync,…}
    path.cpp                         -- path.{join,dirname,basename,extname,resolve,isAbsolute}
    buffer.cpp                       -- Buffer.from, Buffer.alloc over Uint8Array
    require.cpp                      -- CommonJS require() with relative resolution
    timers.cpp                       -- setImmediate / setTimeout / setInterval (synchronous)
test/
  hello.js                           -- smoke test: console, process, argv
  require_chain.js                   -- require() exercise (with mod/adder/greet/util)
  fs_smoke.js                        -- fs + path round-trip
  timers_smoke.js                    -- timer shims
  console_formatting.js              -- verify object/function rendering
  integration.js                     -- end-to-end assertion bundle
  fibonacci.js                       -- recursive JIT target
  jit_smoke.js                       -- tight loop for --ion vs --no-ion comparison
  verify_jit.js                      -- runs in stock js shell; no bridge needed
```

## Current state

Phase 1 (SpiderMonkey build on imacg52) in progress. See
[status-report.md](status-report.md) and
[post-build-checklist.md](post-build-checklist.md) for next steps.
Phase 2 (bridge C++ source) is complete and waiting to link.
