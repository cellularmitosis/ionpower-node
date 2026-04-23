# log-scan

Composition demo for Session G surface. Scans an Apache-ish common-
log-format file, groups by status-code class, and writes a colored
summary to stdout + a JSON sidecar to disk.

Chains eight libraries through the new event-loop / streams /
async-fs / crypto stack:

| library | role |
|---|---|
| `stream.Transform` (built-in) | line parser |
| `split2` | LF-delimited chunker |
| `fs.writeFile` (async callback) | sidecar write |
| `crypto.createHash('sha1')` | input-file fingerprint |
| `chalk` | per-class coloring |
| `hash-sum` | stable per-class bucket IDs |
| `text-table` | aligned summary rows |
| `pretty-ms` | duration formatting |

If the log file doesn't exist, the demo auto-generates a 100-line
synthetic sample so it runs offline.

Usage:

    ./node demos/log-scan/app.js
    ./node demos/log-scan/app.js /path/to/access.log

Output shape: a colored table on stdout, then
`demos/log-scan/results.json` with the same numbers.
