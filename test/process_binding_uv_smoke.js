// Smoke: process.binding('uv').errname(code) returns the libuv-style
// errno name. execa/lib/errname depends on this; without it, every
// npm install in v0.96/0.97 ended with a spurious warning line.

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

var uv = process.binding('uv');
assert(uv && typeof uv === 'object', "process.binding('uv') should be object");
assert(typeof uv.errname === 'function',
       "process.binding('uv').errname should be a function; got " + typeof uv.errname);

assert(uv.errname(-2)  === 'ENOENT',       "errname(-2) -> ENOENT");
assert(uv.errname(-13) === 'EACCES',       "errname(-13) -> EACCES");
assert(uv.errname(-17) === 'EEXIST',       "errname(-17) -> EEXIST");
assert(uv.errname(-21) === 'EISDIR',       "errname(-21) -> EISDIR");
assert(uv.errname(-22) === 'EINVAL',       "errname(-22) -> EINVAL");
assert(uv.errname(-32) === 'EPIPE',        "errname(-32) -> EPIPE");
assert(uv.errname(-60) === 'ETIMEDOUT',    "errname(-60) -> ETIMEDOUT");
assert(uv.errname(-61) === 'ECONNREFUSED', "errname(-61) -> ECONNREFUSED");

// Positive codes are accepted (libuv uses negative, but tolerate either).
assert(uv.errname(2)  === 'ENOENT', "errname(2) tolerated -> ENOENT");

// Unknown code falls back to UV_UNKNOWN(code).
var unknown = uv.errname(-9999);
assert(unknown.indexOf('UV_UNKNOWN') === 0,
       "unknown code should yield UV_UNKNOWN(...); got " + unknown);
assert(unknown.indexOf('-9999') >= 0,
       "unknown code should include the input; got " + unknown);

// Non-'uv' bindings still return {} (no surprise behavior).
var other = process.binding('totally-not-real');
assert(other && typeof other === 'object',
       "unknown binding name should still return {}");
assert(typeof other.errname === 'undefined',
       "unknown binding should NOT have errname");

console.log("process_binding_uv_smoke: errname table + UV_UNKNOWN fallback ok");
