# Hello from PowerPC

This site was built by `ionpower-node` on a real **Power Macintosh G5**
running Mac OS X 10.4 Tiger. The build pipeline is:

1. Read `*.md` files with `fs.readdirSync` + `fs.readFileSync`.
2. Parse markdown through [`marked`](https://github.com/markedjs/marked) 4.3.0.
3. Wrap in a [`handlebars`](https://handlebarsjs.com/) 4.7.8 template.
4. Write HTML via `fs.writeFileSync`.

Every step runs through [TenFourFox](https://github.com/classilla/tenfourfox)'s
IonPower JIT for 32-bit PowerPC — the same JIT that once powered real
Firefox browsing on machines like this one.

## Why this is interesting

- No native Node binary — PowerPC Tiger was dropped from Node support
  before npm was even a thing.
- No transpilation — marked and handlebars load as their own UMD
  bundles and run as-is.
- Everything is synchronous — no event loop, no async/await path.
- The JIT really is doing work: IonPower compiles regex state
  machines and dynamic `new Function()` calls into native PPC code.

## Tests

> This blockquote, that **bold**, and some `inline code` all
> exercise marked's parsing. They should all come through intact.

```js
// And code fences with language tags become <pre><code class="language-js">.
function f(n) { return n < 2 ? n : f(n-1) + f(n-2); }
```
