---
title: "Running Node libraries on a G5"
date: 2026-04-22
author: "j"
tags: [node, g5, ppc]
---

# Running Node libraries on a G5

67 libraries and counting. We keep adding Node-compat bridge surface
until one more library loads, then look for the next gap.

## Highlights

- `handlebars`, `markdown-it`, and `prism` compose into a static-site
  generator that renders this very page.
- `uuid`, `tweetnacl`, and `crypto-js` all produce bit-identical output
  against their x86_64 equivalents.
- `@babel/standalone` runs well enough that we added a transpile-on-
  require hook: modern JS just works.

```javascript
const x = { a: { b: 42 } };
const y = x?.a?.b ?? 0;  // SM45 parse fails; babel rescues
```
