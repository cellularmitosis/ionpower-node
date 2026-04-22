// nearley: parser-combinator-ish engine. We skip the compiler and use
// a hand-written grammar object to exercise the runtime parser.
//
// A minimal grammar that parses "a b a" as (a (b) a).

var nearley = require("./vendor/nearley.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Hand-built compiled grammar: a simple repetition.
// `main -> "a" _ "b" _ "a"` where `_` is whitespace.
var rules = [
    { name: "main", symbols: [ {literal:"a"}, "_", {literal:"b"}, "_", {literal:"a"} ],
      postprocess: function (d) { return [d[0], d[2], d[4]].join("-"); } },
    { name: "_",    symbols: [/[ \t]+/] }
];

var grammar = { Lexer: undefined, ParserRules: rules, ParserStart: "main" };

var p = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
p.feed("a b a");
assert(p.results.length >= 1, "at least one parse: " + p.results.length);
assert(p.results[0] === "a-b-a", "parse result: " + JSON.stringify(p.results[0]));
console.log("ok: nearley runtime parse");

// A repetition grammar: "abab" -> depth-4 with character tokens.
// Without a lexer, nearley feeds char-by-char and literals must be single chars.
var g2 = {
    Lexer: undefined,
    ParserRules: [
        { name: "main",   symbols: ["pair","pair"],
          postprocess: function (d) { return d[0] + d[1]; } },
        { name: "pair",   symbols: [{literal:"a"}, {literal:"b"}],
          postprocess: function () { return "AB"; } }
    ],
    ParserStart: "main"
};
var p2 = new nearley.Parser(nearley.Grammar.fromCompiled(g2));
p2.feed("abab");
assert(p2.results[0] === "ABAB", "abab result: " + JSON.stringify(p2.results[0]));
console.log("ok: nearley pair repetition");

console.log("\nnearley smoke: all assertions passed");
