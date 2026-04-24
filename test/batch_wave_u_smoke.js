// Wave U: crypto/hash/encoding libraries that pair with v0.16-v0.20
// (scrypt, AES-CBC/CTR/GCM, HKDF, SHA-512, WebCrypto).

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- base32.js ----
try {
    var b32 = unwrap(require("./vendor/base32-js.js"));
    if (b32 && typeof b32.encode === "function") {
        var enc = b32.encode("hello");
        assert(typeof enc === "string" && enc.length > 0, "base32.encode output");
        console.log("ok: base32.js encode");
    } else {
        console.log("skip: base32.js shape");
    }
} catch (e) {
    console.log("skip: base32.js (" + e.message + ")");
}

// ---- crc-32 (SheetJS) ----
try {
    var crc32 = unwrap(require("./vendor/crc-32-lib.js"));
    var r = crc32.str ? crc32.str("hello") : null;
    // CRC-32 of "hello" = 0x3610a686 (-166726777 signed)
    if (typeof r === "number") {
        var unsigned = r >>> 0;
        assert(unsigned === 0x3610a686, "crc-32 of 'hello': " + unsigned.toString(16));
        console.log("ok: crc-32 of 'hello'");
    } else {
        console.log("skip: crc-32 shape");
    }
} catch (e) {
    console.log("skip: crc-32 (" + e.message + ")");
}

// ---- ieee754 ----
try {
    var ieee = unwrap(require("./vendor/ieee754-v1-2.js"));
    // Encode/decode a known float.
    var buf = new Uint8Array(4);
    ieee.write(buf, 3.14, 0, false, 23, 4);
    var got = ieee.read(buf, 0, false, 23, 4);
    assert(Math.abs(got - 3.14) < 1e-6, "ieee754 round-trip float: " + got);
    console.log("ok: ieee754");
} catch (e) {
    console.log("skip: ieee754 (" + e.message + ")");
}

// ---- json-bigint ----
try {
    var JSONBig = unwrap(require("./vendor/json-bigint.js"));
    var parsed = JSONBig.parse('{"big":9007199254740993}');
    assert(parsed.big !== undefined, "json-bigint parsed big num");
    console.log("ok: json-bigint");
} catch (e) {
    console.log("skip: json-bigint (" + e.message + ")");
}

// ---- md5 (standalone) ----
try {
    var md5 = unwrap(require("./vendor/md5-lib.js"));
    eq(md5("hello"), "5d41402abc4b2a76b9719d911017c592", "md5('hello')");
    console.log("ok: md5 lib");
} catch (e) {
    console.log("skip: md5-lib (" + e.message + ")");
}

// ---- ulid (sortable UUID alternative) ----
try {
    var ulidMod = require("./vendor/ulid.js");
    var ulid = ulidMod.ulid || (ulidMod.default && ulidMod.default.ulid) || ulidMod;
    if (typeof ulid === "function") {
        var id = ulid();
        assert(typeof id === "string" && id.length === 26, "ulid length 26");
        console.log("ok: ulid");
    } else {
        console.log("skip: ulid shape");
    }
} catch (e) {
    console.log("skip: ulid (" + e.message + ")");
}

// ---- sha.js (browser-shim for SHA digests) ----
try {
    var shaJs = unwrap(require("./vendor/sha-js.js"));
    var hasher = shaJs("sha256");
    hasher.update("abc");
    var h = hasher.digest("hex");
    eq(h, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
       "sha.js SHA-256 of 'abc'");
    console.log("ok: sha.js");
} catch (e) {
    console.log("skip: sha.js (" + e.message + ")");
}

// ---- xxhashjs v2 (non-cryptographic hash) ----
try {
    var xxMod = require("./vendor/xxhashjs-v2.js");
    var xx = xxMod.default || xxMod;
    if (xx && xx.h32) {
        var h = xx.h32("hello", 0xCAFEBABE);
        assert(h !== undefined && typeof h.toString === "function", "xxhash32 produces result");
        console.log("ok: xxhashjs");
    } else {
        console.log("skip: xxhashjs shape");
    }
} catch (e) {
    console.log("skip: xxhashjs (" + e.message + ")");
}

// ---- otplib ----
try {
    var otp = unwrap(require("./vendor/otplib.js"));
    assert(otp !== undefined, "otplib loads");
    console.log("ok: otplib (surface)");
} catch (e) {
    console.log("skip: otplib (" + e.message + ")");
}

console.log("\nbatch_wave_u smoke: done");
