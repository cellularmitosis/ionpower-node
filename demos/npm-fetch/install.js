#!/usr/bin/env node
// install.js — fetch + decompress + extract + require an npm package
// from registry.npmjs.org, end-to-end on PowerPC Tiger.
//
//   ./node demos/npm-fetch/install.js <package> [version]
//
// Demonstrates that the v0.66-v0.71 stack — fetch / zlib gunzip /
// fs.writeFile / require() — is enough to consume the modern Node
// ecosystem on a 1999 iBook G3.
//
// Default target if none given: 'mri' (minimal arg parser, single
// file, no deps, ~13 KB unpacked — fast to demo).

var fs   = require("fs");
var path = require("path");
var zlib = require("zlib");

var pkgName    = process.argv[2] || "mri";
var pkgVersion = process.argv[3] || "latest";

var t0 = Date.now();

// ---- Phase 1: registry lookup ----
console.log("[1] resolving " + pkgName + "@" + pkgVersion + " from registry.npmjs.org");
var registryUrl = "https://registry.npmjs.org/" + pkgName;
var phase = Date.now();

fetch(registryUrl).then(function (res) {
    if (!res.ok) throw new Error("registry returned HTTP " + res.status);
    return res.json();
}).then(function (meta) {
    console.log("    metadata fetched in " + (Date.now() - phase) + " ms");
    var resolvedVersion = pkgVersion === "latest"
        ? meta["dist-tags"].latest
        : pkgVersion;
    var versionMeta = meta.versions[resolvedVersion];
    if (!versionMeta) throw new Error("version " + resolvedVersion + " not found");
    var tarballUrl = versionMeta.dist.tarball;
    console.log("    -> " + pkgName + "@" + resolvedVersion);
    console.log("       " + tarballUrl);

    // ---- Phase 2: tarball download ----
    console.log("[2] downloading tarball");
    phase = Date.now();
    return fetch(tarballUrl).then(function (res) {
        if (!res.ok) throw new Error("tarball fetch returned HTTP " + res.status);
        return res.arrayBuffer().then(function (buf) {
            return { resolvedVersion: resolvedVersion, tarball: Buffer.from(buf) };
        });
    });
}).then(function (state) {
    var gz = state.tarball;
    console.log("    " + gz.length + " bytes (.tgz) in " + (Date.now() - phase) + " ms");

    // ---- Phase 3: gunzip via real DEFLATE inflate (tiny-inflate) ----
    console.log("[3] gunzipping via zlib.gunzipSync (tiny-inflate)");
    phase = Date.now();
    var tar = zlib.gunzipSync(gz);
    console.log("    " + tar.length + " bytes (.tar) in " + (Date.now() - phase) + " ms"
                + "  [" + Math.round(tar.length / gz.length * 100) / 100 + "x expansion]");

    // ---- Phase 4: tar extract ----
    console.log("[4] parsing POSIX ustar archive");
    phase = Date.now();
    var entries = parseTar(tar);
    console.log("    " + entries.length + " entries (" +
                entries.filter(function (e) { return e.type === "file"; }).length + " files) in " +
                (Date.now() - phase) + " ms");

    // ---- Phase 5: write to ./node_modules/<name>/ ----
    var destRoot = path.join(process.cwd(), "node_modules", pkgName);
    console.log("[5] writing to " + destRoot);
    phase = Date.now();
    var written = 0;
    for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.type !== "file") continue;
        // npm tarballs prefix all paths with 'package/' — strip it.
        var rel = e.name.replace(/^package\//, "");
        if (!rel) continue;
        var dest = path.join(destRoot, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, e.data);
        written++;
    }
    console.log("    " + written + " files written in " + (Date.now() - phase) + " ms");

    // ---- Phase 6: require + use ----
    console.log("[6] require('" + pkgName + "') + sanity check");
    phase = Date.now();
    var loaded = require(destRoot);
    console.log("    loaded in " + (Date.now() - phase) + " ms");

    // Run a tiny demo per known package; for unknown packages just
    // print the surface.
    runDemo(pkgName, loaded);

    console.log("");
    console.log("=== " + pkgName + "@" + state.resolvedVersion + " installed end-to-end in " +
                (Date.now() - t0) + " ms ===");
}).catch(function (e) {
    console.error("FAIL: " + (e && e.stack || e));
    process.exit(1);
});

// ---- POSIX ustar parser. Each entry = 512 byte header + ceil(size/512)*512 data ----
function parseTar(buf) {
    var entries = [];
    var pos = 0;
    while (pos + 512 <= buf.length) {
        var name = readStr(buf, pos, 100);
        if (!name) {                      // empty header => end of archive
            // Look for the trailing zero block. We just stop at first.
            break;
        }
        var size = parseInt(readStr(buf, pos + 124, 12).trim() || "0", 8) || 0;
        var typeflag = String.fromCharCode(buf[pos + 156] || 0x30);
        var prefix = readStr(buf, pos + 345, 155);
        if (prefix) name = prefix + "/" + name;
        var type = "other";
        if (typeflag === "0" || typeflag === "\0") type = "file";
        else if (typeflag === "5")                type = "dir";
        else if (typeflag === "1" || typeflag === "2") type = "link";
        var dataStart = pos + 512;
        var data = (type === "file") ? buf.slice(dataStart, dataStart + size) : null;
        entries.push({ name: name, size: size, type: type, data: data });
        // Advance past header + data, padded to 512-byte boundary.
        pos = dataStart + Math.ceil(size / 512) * 512;
    }
    return entries;
}

function readStr(buf, off, len) {
    var end = off;
    var max = off + len;
    while (end < max && buf[end] !== 0) end++;
    return buf.slice(off, end).toString("utf8");
}

// ---- Per-package demos. These keep the showcase concrete. ----
function runDemo(pkgName, mod) {
    if (pkgName === "mri") {
        var argv = mod(["--port", "8080", "--verbose", "--", "extra1", "extra2"]);
        console.log("    mri parsed: " + JSON.stringify(argv));
        // mri auto-coerces numeric values, so .port may be 8080 (number)
        // or "8080" (string) depending on version.
        if (String(argv.port) !== "8080" || !argv.verbose) {
            console.error("    FAIL: mri output not as expected");
            process.exit(1);
        }
        console.log("    OK: mri parsed --port 8080 --verbose into a real options object");
        return;
    }
    if (pkgName === "is-number") {
        console.log("    is-number(42) = " + mod(42));
        console.log("    is-number('1e3') = " + mod("1e3"));
        console.log("    is-number({}) = " + mod({}));
        return;
    }
    // Unknown: just summarise the surface.
    var keys = (mod && typeof mod === "object")
        ? Object.keys(mod).slice(0, 8)
        : [typeof mod];
    console.log("    surface: " + JSON.stringify(keys));
}
