// yargs-parser: the argv parser that underlies yargs + (via minimist-
// options glue) meow. Strictly larger than our existing mri/arg/minimist
// entries but with proper alias + type coercion support.

var yp = require("./vendor/yargs-parser.js");
var parse = yp.default || yp;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var out = parse(["--foo", "bar", "-n", "42", "pos1", "pos2"]);
eq(out.foo, "bar", "long --foo");
eq(out.n, 42, "-n coerced to number");
eq(out._, ["pos1", "pos2"], "positionals in _");
console.log("ok: yargs-parser basic");

// Alias mapping.
out = parse(["-v"], { alias: { v: "version" } });
eq(out.v, true, "-v is true");
eq(out.version, true, "alias propagates");
console.log("ok: yargs-parser aliases");

// String coercion: force --port to string even if numeric-looking.
out = parse(["--port", "8080"], { string: ["port"] });
eq(out.port, "8080", "--port kept as string");
console.log("ok: yargs-parser string type");

console.log("\nyargs-parser smoke: all assertions passed");
