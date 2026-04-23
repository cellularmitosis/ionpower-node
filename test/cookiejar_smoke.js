// cookiejar: TJ-style persistent cookie jar.

var cj = require("./vendor/cookiejar.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var jar = new cj.CookieJar();
jar.setCookie("name=alice; Domain=example.com; Path=/");
jar.setCookie("theme=dark; Domain=example.com; Path=/settings");

var at_root = jar.getCookies(cj.CookieAccessInfo("example.com", "/"));
assert(at_root.length >= 1, "has name cookie at root");
assert(at_root.some(function (c) { return c.name === "name" && c.value === "alice"; }),
       "name=alice found");
console.log("ok: set + get at root");

var at_settings = jar.getCookies(cj.CookieAccessInfo("example.com", "/settings"));
assert(at_settings.some(function (c) { return c.name === "theme" && c.value === "dark"; }),
       "theme=dark found at /settings");
console.log("ok: nested path");

console.log("\ncookiejar smoke: all assertions passed");
