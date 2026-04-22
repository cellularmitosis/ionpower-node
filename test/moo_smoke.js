// Smoke test: moo (fast lexer) on ionpower-node.
var moo = require("./vendor/moo.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var lexer = moo.compile({
    WS:       /[ \t]+/,
    comment:  /\/\/.*?$/,
    number:   /(?:0|[1-9][0-9]*)/,
    string:   /"(?:\\["\\]|[^\n"\\])*"/,
    lparen:   "(",
    rparen:   ")",
    keyword:  ["while", "if", "else", "moo"],
    NL:       { match: /\n/, lineBreaks: true }
});

lexer.reset("moo( 42 \"hi\" ) // done\n");

var tokens = [];
var tok;
while ((tok = lexer.next())) {
    if (tok.type !== "WS" && tok.type !== "NL") {
        tokens.push([tok.type, tok.value]);
    }
}
console.log("tokens:", JSON.stringify(tokens));

// Check expected token stream.
var expected = [
    ["keyword", "moo"],
    ["lparen", "("],
    ["number", "42"],
    ["string", "\"hi\""],
    ["rparen", ")"],
    ["comment", "// done"]
];
assert(tokens.length === expected.length, "count: " + tokens.length);
for (var i = 0; i < expected.length; ++i) {
    assert(tokens[i][0] === expected[i][0],
           "type[" + i + "]: got " + tokens[i][0] + " want " + expected[i][0]);
    assert(tokens[i][1] === expected[i][1],
           "value[" + i + "]: got " + tokens[i][1] + " want " + expected[i][1]);
}
console.log("ok: 6 tokens match expected stream");

console.log("\nmoo smoke: all assertions passed");
