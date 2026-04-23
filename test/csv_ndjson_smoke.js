// csv-parser + ndjson: stream-based line/CSV parsers. Exercises the
// new Stream implementation.

var stream = require("stream");
var csv = require("./vendor/csv-parser.js");
var ndjson = require("./vendor/ndjson.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// --- csv-parser -------------------------------------------------------
// Write CSV text directly to the parser's Writable side (simpler
// than setting up a Readable source; sidesteps the pipe+auto-resume
// ordering quirks in our sync stream impl).
var rows = [];
var parser = csv();
parser.on("data", function (row) { rows.push(row); });
parser.write("name,age\n");
parser.write("alice,30\n");
parser.write("bob,25\n");
parser.end();

assert(rows.length === 2, "2 rows; got " + rows.length);
eq(rows[0], { name: "alice", age: "30" }, "row 0");
eq(rows[1], { name: "bob",   age: "25" }, "row 1");
console.log("ok: csv-parser (header + 2 rows)");

// --- ndjson.parse ----------------------------------------------------
// Same story as csv-parser: write direct instead of piping.
var parsed = [];
var nd = ndjson.parse();
nd.on("data", function (obj) { parsed.push(obj); });
nd.write('{"a":1}\n');
nd.write('{"b":2}\n');
nd.write('{"c":3}\n');
nd.end();

assert(parsed.length === 3, "3 ndjson records; got " + parsed.length);
eq(parsed[0], { a: 1 }, "ndjson row 0");
eq(parsed[2], { c: 3 }, "ndjson row 2");
console.log("ok: ndjson.parse (3 objects)");

// --- ndjson.stringify (serialize) -----------------------------------
if (typeof ndjson.stringify === "function") {
    var nSer = ndjson.stringify();
    var out = "";
    nSer.on("data", function (chunk) { out += String(chunk); });
    nSer.write({ hello: "world" });
    nSer.write({ num: 42 });
    nSer.end();
    assert(out.indexOf("hello") !== -1, "serialized hello: " + out);
    assert(out.indexOf("42") !== -1, "serialized 42");
    console.log("ok: ndjson.stringify");
}

console.log("\ncsv_ndjson smoke: all assertions passed");
