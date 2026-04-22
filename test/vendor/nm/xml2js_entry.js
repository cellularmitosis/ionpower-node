var xml2js = require("xml2js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var xml = [
    "<config>",
    "  <name>ionpower-node</name>",
    "  <version>0.1.0</version>",
    "  <targets>",
    "    <cpu>G3</cpu>",
    "    <cpu>G4</cpu>",
    "    <cpu>G5</cpu>",
    "  </targets>",
    "  <debug>true</debug>",
    "</config>"
].join("\n");

// Parse.
var parsed = null;
xml2js.parseString(xml, { explicitArray: false }, function (err, result) {
    if (err) { console.error("parseString err:", err); process.exit(1); }
    parsed = result;
});
// parseString is sync when the input string is given.
assert(parsed !== null, "parseString delivered a result");
console.log("parsed:", JSON.stringify(parsed));

assert(parsed.config.name === "ionpower-node", "name");
assert(parsed.config.version === "0.1.0",      "version");
assert(JSON.stringify(parsed.config.targets.cpu) === '["G3","G4","G5"]',
       "cpu list: " + JSON.stringify(parsed.config.targets.cpu));
console.log("ok: parsed object shape matches");

// Build.
var builder = new xml2js.Builder({ headless: true });
var rebuilt = builder.buildObject({
    greeting: "hello, world"
});
assert(rebuilt.indexOf("<greeting>hello, world</greeting>") >= 0,
       "build produced expected XML: " + rebuilt);
console.log("ok: Builder.buildObject:", rebuilt.trim());

console.log("\nxml2js smoke: all assertions passed");
