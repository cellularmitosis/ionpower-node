var iconv = require("iconv-lite");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Encode UTF-8 -> Latin1
var b1 = iconv.encode("Héllo", "latin1");
assert(b1.length === 5, "latin1 bytes: " + b1.length);
assert(b1[0] === 0x48 && b1[1] === 0xE9 && b1[2] === 0x6C, "latin1 Hé l bytes");
console.log("ok: encode latin1 ('é' -> 0xE9)");

// Decode back.
var back = iconv.decode(b1, "latin1");
assert(back === "Héllo", "latin1 roundtrip: " + JSON.stringify(back));
console.log("ok: decode latin1");

// UTF-16.
var u16 = iconv.encode("hi", "utf16-le");
assert(u16.length === 4, "utf16-le 'hi' = 4 bytes");
assert(u16[0] === 0x68 && u16[1] === 0x00 && u16[2] === 0x69 && u16[3] === 0x00, "utf16-le bytes");
console.log("ok: utf16-le encode");

// UTF-8.
var u8 = iconv.encode("caf\u00e9", "utf8");
assert(u8.length === 5, "'café' utf8 length 5; got " + u8.length);
console.log("ok: utf8 encode length");

// Encoding support check.
assert(iconv.encodingExists("latin1"), "latin1 supported");
assert(iconv.encodingExists("win1252"), "windows-1252 supported");

console.log("\niconv-lite smoke: all assertions passed");
