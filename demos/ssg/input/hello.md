---
title: Hello from PowerPC
author: ionpower-node
date: 2026-04-22
---

# Hello from PowerPC

This page was built by `ionpower-node` on a real **Power Macintosh G5**
running Mac OS X 10.4 Tiger. The build pipeline is:

1. YAML frontmatter via `js-yaml` — sets title, author, date.
2. Markdown body through `markdown-it` 13.
3. Fenced code blocks highlighted by `prism.js` 1.29.
4. HTML wrapped in a `handlebars` template.
5. Slug from the title via `slugify`.
6. `fs.writeFileSync` writes the final `.html`.

All seven libraries ([see the compat matrix](../../docs/compat.md))
run unmodified on IonPower — TenFourFox's 32-bit PowerPC JIT.

## Syntax-highlighted code

```js
// Recursive fib is an Ion-compiler sweet spot: pure arithmetic,
// tight call graph, no allocations after warmup.
function fib(n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}
console.log(fib(32));    // 2178309
```

```css
body {
    font-family: "Lucida Grande", sans-serif;
    max-width: 42em;
    margin: 2em auto;
}
```

## A blockquote

> This blockquote, some *italic*, and a bit of `inline code`
> all exercise markdown-it's parsing. They should all come
> through cleanly.

## That's all

The [TenFourFox](https://github.com/classilla/tenfourfox) IonPower
backend at `js/src/jit/osxppc/` made this possible.
