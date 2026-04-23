# url-dashboard

Composition demo: take a list of URLs, parse each with the built-in
`URL` polyfill, bucket by host, and render a colorized boxed table.

Chains seven vendored libraries end-to-end:

| library | role |
|---|---|
| `URL` (built-in) | parse each URL into components |
| `sort-keys` | deterministic per-host iteration |
| `chalk` | per-column color |
| `string-width` + `strip-ansi` | accurate width for alignment + our own frame drawer |
| `text-table` | ASCII-table rendering |
| `hash-sum` | stable per-host hash |
| `pretty-ms` | "parse took Xms" footer |

(`boxen` would be the natural frame choice; we use a tiny inline
drawer since `boxen`'s wrap-ansi path uses ES2018 named capture
groups SM45 can't parse.)

Usage:

    ./node demos/url-dashboard/dashboard.js
    ./node demos/url-dashboard/dashboard.js <url> [<url> ...]

The default corpus is bundled in `dashboard.js` — 10 URLs across 5
hosts — so the demo works offline.
