# ionpower-node npm-fetch — install an npm package on a 1999 G3

End-to-end download + decompress + extract + require of an npm
package, hitting `registry.npmjs.org` from a PowerPC iBook G3.

```
$ ssh ibookg37 './node demos/npm-fetch/install.js mri'
[1] resolving mri@latest from registry.npmjs.org
    metadata fetched in 344 ms
    -> mri@1.2.0
       https://registry.npmjs.org/mri/-/mri-1.2.0.tgz
[2] downloading tarball
    4448 bytes (.tgz) in 307 ms
[3] gunzipping via zlib.gunzipSync (tiny-inflate)
    18432 bytes (.tar) in 38 ms  [4.14x expansion]
[4] parsing POSIX ustar archive
    6 entries (6 files) in 25 ms
[5] writing to /Users/macuser/tmp/ionpower-node/node_modules/mri
    6 files written in 15 ms
[6] require('mri') + sanity check
    loaded in 6 ms
    mri parsed: {"_":["extra1","extra2"],"port":8080,"verbose":true}
    OK: mri parsed --port 8080 --verbose into a real options object

=== mri@1.2.0 installed end-to-end in 754 ms ===
```

## What this proves

The PowerPC G3 pre-dates Node.js by years (Node first shipped 2009;
this iBook is from 1999). The runtime here is consuming the live npm
ecosystem in 2026, doing every step by itself — no `npm` binary
involved:

| Phase | Subsystem |
|---|---|
| Registry HTTP   | `fetch` over the sync curl shim (HTTPS) |
| Tarball stream  | `Response.arrayBuffer()` -> `Buffer` |
| Gunzip          | `zlib.gunzipSync` (real RFC 1951 inflate via tiny-inflate) |
| Tar parse       | inline POSIX ustar reader (header parsing in pure JS) |
| Disk write      | `fs.mkdirSync({recursive:true})` + `fs.writeFileSync` |
| Module load     | `require()` resolves the just-extracted `package.json` `main` |
| Demo            | run the loaded function against test inputs |

## Try other packages

```
./node demos/npm-fetch/install.js is-number
./node demos/npm-fetch/install.js cuid
./node demos/npm-fetch/install.js <anything-with-no-deps-or-already-vendored>
```

If the package has dependencies that aren't already vendored, the
top-level `require()` will fail to resolve them — this script
doesn't recursively install. That's fine for a focused demo. Real
npm install with full dep graph resolution is much more work and
isn't the point.
