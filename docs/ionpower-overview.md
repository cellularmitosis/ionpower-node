# The IonPower backend, in one page

Source of truth: `external/tenfourfox/js/src/jit/osxppc/` in this repo,
which is a sparse checkout of TenFourFox master (commit `51ec6270`).
This page is a cheat-sheet for reviewers who've done SpiderMonkey
work on some other architecture and want to orient themselves in
ours. Not a tutorial.

## Position in the stack

SpiderMonkey has three execution tiers (from slowest to fastest):

1. **Interpreter** (`vm/Interpreter.cpp`). Always available. Runs
   bytecode in a switch loop.
2. **Baseline JIT** (`jit/BaselineCompiler.cpp`, ours in
   `BaselineCompiler-ppc.cpp` + `BaselineIC-ppc.cpp`). Template
   compiler: one assembly snippet per bytecode opcode, stitched
   together. Inline caches (`IC`s) specialize on type at run time.
3. **Ion JIT** (`jit/CodeGenerator.cpp`, ours in
   `CodeGenerator-ppc.cpp`). Full optimizing compiler: MIR → LIR
   → machine code, with GVN, LICM, range analysis, scalar
   replacement, loop unrolling, etc.

IonPower supplies the PPC flavor of tiers 2 and 3.

## File roles

| file | role |
|---|---|
| `Architecture-ppc.{cpp,h}` | Register class, enum; stack layout constants; nunbox32 byte offsets. |
| `Assembler-ppc.{cpp,h}` | Emits raw PPC instructions (32-bit encoding). The ground layer — every other file eventually reaches here. |
| `MacroAssembler-ppc.{cpp,h}` + `MacroAssembler-ppc-inl.h` | Higher-level patterns: branches that can be long or short, register moves, condition codes, load/store helpers. |
| `CodeGenerator-ppc.{cpp,h}` | Ion backend: walks LIR and emits PPC via the MacroAssembler. Contains special cases for POWER4/970 instructions (`#warning using native POWER4/970 square root`). |
| `Lowering-ppc.{cpp,h}`, `LIR-ppc.h`, `LOpcodes-ppc.h` | MIR→LIR pass: decides how many LIR operands each MIR node needs, where its result lives, whether it's constrained to particular registers (e.g. shift counts in `rcx` on x86 have an analog here). |
| `BaselineCompiler-ppc.{cpp,h}` | The Baseline-tier entry points for PPC — tiny glue, almost all code lives in `shared/BaselineCompiler-shared.h`. |
| `BaselineIC-ppc.cpp` | Inline cache stubs written for PPC. |
| `Trampoline-ppc.cpp` (56 KB!) | Entry/exit bridges between C++ and JIT code: saving/restoring callee-saved regs, boxing/unboxing values, stack alignment, bailout paths. |
| `Bailouts-ppc.{cpp,h}` | When an Ion-compiled function can't continue (type guard fails, etc.) we "bail out" to the Baseline interpreter. This file contains the handler that reads the Ion frame and reconstructs a Baseline frame. |
| `MoveEmitter-ppc.{cpp,h}` | Resolves parallel register moves without scratch clobbers. |
| `SharedICHelpers-ppc.h`, `SharedICRegisters-ppc.h` | Constants wired up by `jit/shared/` so the generic baseline-IC machinery can assemble PPC-specific sequences. |
| `AtomicOperations-ppc.h` | lwsync/isync patterns for `Atomics.*`. |

## Register allocation (gleaned from `Architecture-ppc.h`)

- `r0` = temporary (`tempRegister`). Some PPC instructions treat r0
  as an immediate-zero source, so it's dangerous to give to the RA.
- `r1` = `sp` (stack pointer). Reserved.
- `r2` = TOC pointer in AIX/ppc64; on Darwin/ppc32 this is a free
  GPR, used here.
- `r12` = `addressTempRegister`. Used as a scratch for loads/stores
  that compute an address before using it.
- `lr` occupies a register-ID slot for the benefit of push-regs
  code even though the hardware `lr` is separate — the comment
  warns "This is a lie so that pushing register sets works. We never
  use r11."
- `BAILOUT_TABLE_ENTRY_SIZE = sizeof(void*)` — one `bl` per bailout.

## Nunbox32 layout is big-endian

`Architecture-ppc.h`:

```cpp
// We are big-endian, unlike all those other puny little-endian
// architectures, so we use different constants. (type == tag)
static const int32_t NUNBOX32_TYPE_OFFSET    = 0;
static const int32_t NUNBOX32_PAYLOAD_OFFSET = 4;
```

Everywhere else (x86, ARM), the JIT-built code assumes
`TYPE_OFFSET = 4`, `PAYLOAD_OFFSET = 0`. This single flip propagates
into every `Value` load/store in all of MacroAssembler-ppc. Ported
code should **not** touch these constants.

## What selecting the JIT depends on

`js/src/configure.in:3164-3170`:

```
elif test "$CPU_ARCH" = "ppc"; then
    AC_DEFINE(JS_CODEGEN_PPC_OSX)
    JS_CODEGEN_PPC_OSX=1
elif test "$CPU_ARCH" = "ppc64"; then
    AC_DEFINE(JS_CODEGEN_PPC_OSX)
    JS_CODEGEN_PPC_OSX=1
fi
```

...followed by per-arch moz.build magic that only includes
`js/src/jit/osxppc/` when `CONFIG['JS_CODEGEN_PPC_OSX']` is set.
So as long as `CPU_ARCH=ppc` is what configure detects on darwin-ppc
(yes — it does, via the host-ppc-apple-darwin tuple), the backend is
wired in automatically.

This implies: **you don't need `--enable-jit` or similar** — if the
build host looks like PPC, the JIT is in. Conversely, a cross-build
to x86_64 that happens to include osxppc files will define
`JS_CODEGEN_X64` instead and the PPC files won't link. There is no
PPC simulator: you can only run this code on real PPC hardware.

## Relationship to the earlier "PPCBC"

Cameron Kaiser's writeups call out that IonPower was written
from-scratch after an earlier PowerPC-Baseline-Compiler (PPCBC) had
proved too tied to Baseline's quirks to be extensible to Ion.
IonPower is what lives in `osxppc/` today; PPCBC code is not in the
master tree.

## What we use it for

Nothing special. Our embedder (`src/main.cpp` in this project) just
creates a `JSRuntime` + `JSContext`, enters a compartment, and
`JS::Evaluate`s script text. SpiderMonkey drives Baseline/Ion on its
own based on how hot each function gets. The JIT isn't an opt-in
from the embedder side; it's on unless the runtime option
`JSRuntimeOption::setBaseline(false)` / `setIon(false)` is passed.

Put differently: on stock ionpower-node, the JIT is active by
default. You have to work to turn it off.
