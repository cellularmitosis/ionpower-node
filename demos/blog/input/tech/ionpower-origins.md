---
title: "The IonPower JIT, one decade on"
date: 2026-04-21
author: "j"
tags: [jit, ppc, retro]
---

# The IonPower JIT, one decade on

Back in 2015, the TenFourFox team wrote a **32-bit PowerPC backend** for
Mozilla's new IonMonkey JIT. That backend still runs in this very
process — a decade later, on a different runtime entirely.

## Why it still matters

- 13.7× faster than the interpreter on tight integer loops.
- Dispatches MacroAssembler ops into real PPC opcodes.
- Works on G3, G4, *and* G5 with a single source tree.

```javascript
// Something the JIT actually speeds up
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
```

> The IonPower contribution was never upstreamed; without TenFourFox's
> fork we wouldn't have it at all.
