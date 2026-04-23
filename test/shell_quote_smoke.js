// shell-quote: quote/parse a shell-command argv. Used anywhere a lib
// needs to round-trip a command line (execa, cross-spawn debug, etc).

var sq = require("./vendor/shell-quote.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// quote
eq(sq.quote(["a", "b c", "d"]), "a 'b c' d", "quote with space");
eq(sq.quote(["echo", "hello world"]), "echo 'hello world'", "echo");
// $ needs escaping in unquoted words.
eq(sq.quote(["$var"]), "\\$var", "bare $ escaped");
console.log("ok: shell-quote.quote");

// parse
eq(sq.parse("a b c"), ["a", "b", "c"], "simple parse");
eq(sq.parse("echo 'hello world'"), ["echo", "hello world"], "parse single-quoted");
eq(sq.parse('grep "foo bar"'), ["grep", "foo bar"], "parse double-quoted");
console.log("ok: shell-quote.parse");

console.log("\nshell-quote smoke: all assertions passed");
