# feed-report

Small CLI demo that reads an RSS/Atom XML feed and prints a colorized,
aligned summary. Exercises five libraries in composition:

| library     | role                                           |
|-------------|------------------------------------------------|
| `xmldoc`    | parse the feed XML (via the sax pure-JS core)  |
| `ansi-styles` | colored section headings + severity indicators |
| `strip-ansi`  | for width measurement, before layout           |
| `string-width` | align the `[n]` gutter across emoji / CJK    |
| `color-hash`  | deterministic color per author/source          |
| `pretty-ms`   | format the "n hours ago" freshness line       |

Usage:

    ionpower-node demos/feed-report/report.js demos/feed-report/sample.xml

Sample input is bundled so you don't need network access.
