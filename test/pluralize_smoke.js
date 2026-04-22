// Smoke test: pluralize on ionpower-node.
var pluralize = require("./vendor/pluralize.js");

function eq(label, got, want) {
    if (got === want) console.log("ok: " + label + " -> " + got);
    else { console.error("FAIL: " + label + "\n  got: " + got + "\n  want: " + want); process.exit(1); }
}

eq("cat",       pluralize("cat"),       "cats");
eq("mouse",     pluralize("mouse"),     "mice");
eq("child",     pluralize("child"),     "children");
eq("person",    pluralize("person"),    "people");
eq("fish",      pluralize("fish"),      "fish");
eq("datum",     pluralize("datum"),     "data");
eq("analysis",  pluralize("analysis"),  "analyses");
eq("singular('dogs')", pluralize.singular("dogs"), "dog");
eq("singular('children')", pluralize.singular("children"), "child");
eq("count=1",   pluralize("test", 1),   "test");
eq("count=2",   pluralize("test", 2),   "tests");
eq("inclusive", pluralize("test", 2, true), "2 tests");

console.log("\npluralize smoke: all assertions passed");
