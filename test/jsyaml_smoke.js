// Smoke test: js-yaml (YAML 1.1 parser) on ionpower-node.
const yaml = require("./vendor/js-yaml.js");

var passed = 0, failed = 0;
function eq(label, got, want) {
    var ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { passed++; console.log("ok: " + label); }
    else { failed++; console.error("FAIL: " + label +
                                    "\n  got:  " + JSON.stringify(got) +
                                    "\n  want: " + JSON.stringify(want)); }
}

// Flow and block styles.
eq("flow scalar",    yaml.load("hello"),                "hello");
eq("flow mapping",   yaml.load("{a: 1, b: 2}"),         { a: 1, b: 2 });
eq("flow sequence",  yaml.load("[1, 2, 3]"),            [1, 2, 3]);

// Block mapping.
eq("block map",
   yaml.load("a: 1\nb: 2\n"),
   { a: 1, b: 2 });

// Nested block.
eq("nested block",
   yaml.load("user:\n  name: alice\n  age: 30\ntags:\n  - dev\n  - pm\n"),
   { user: { name: "alice", age: 30 }, tags: ["dev", "pm"] });

// Multi-line string (literal block scalar).
eq("literal block",
   yaml.load("msg: |\n  line one\n  line two\n"),
   { msg: "line one\nline two\n" });

// Booleans and nulls.
eq("bools and null",
   yaml.load("on: true\noff: false\nnone: ~\n"),
   { on: true, off: false, none: null });

// Anchors + aliases.
eq("anchor alias",
   yaml.load("base: &a\n  x: 1\nderived:\n  <<: *a\n  y: 2\n"),
   { base: { x: 1 }, derived: { x: 1, y: 2 } });

// Dump round-trip.
var obj = { name: "ionpower", works: true, libs: ["marked", "acorn"], depth: { nested: 42 } };
var text = yaml.dump(obj);
eq("dump round-trip", yaml.load(text), obj);
console.log("dumped:\n" + text);

console.log("\njs-yaml smoke: " + passed + "/" + (passed + failed) + " passed");
if (failed) process.exit(1);
