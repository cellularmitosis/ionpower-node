// process.version policy smoke (Node 10 parity, pass 1).
//
// As of v0.87, ionpower-node reports a real Node version string in
// process.version so libraries that semver-parse it don't throw.
// Runtime identity moves into process.versions['ionpower-node'].
// See docs/plans/node-target-version.md for the policy decision.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(process.version === "v10.24.1",
       "process.version expected 'v10.24.1', got " + JSON.stringify(process.version));
console.log("ok: process.version =", process.version);

assert(typeof process.versions === "object" && process.versions !== null,
       "process.versions is object");
assert(process.versions.node === "10.24.1",
       "process.versions.node expected '10.24.1', got " +
       JSON.stringify(process.versions.node));
console.log("ok: process.versions.node =", process.versions.node);

// Bracket form: the property name has a dash so dotted access errors.
assert(process.versions["ionpower-node"] === "0.87",
       "process.versions['ionpower-node'] expected '0.87', got " +
       JSON.stringify(process.versions["ionpower-node"]));
console.log("ok: process.versions['ionpower-node'] =",
            process.versions["ionpower-node"]);

// Parsing-shape sanity: the string must look like a real Node version
// (leading 'v', three dotted numeric components). This is what npm
// 6.14.18's checkVersion -> semver.satisfies expects.
assert(/^v\d+\.\d+\.\d+$/.test(process.version),
       "process.version must look like vN.N.N");
var major = parseInt(process.version.slice(1).split(".")[0], 10);
assert(major === 10, "parsed major version expected 10, got " + major);
console.log("ok: process.version parses as Node major =", major);

console.log("\nprocess version smoke: all assertions passed");
