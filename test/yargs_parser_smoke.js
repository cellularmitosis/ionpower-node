// yargs-parser: the argv parser that underlies yargs + (via minimist-
// options glue) meow. Strictly larger than our existing mri/arg/minimist
// entries but with proper alias + type coercion support.

// yargs-parser refuses to load on Node < 12 by throwing at module load.
// We currently report Node 10.24.1 (ionpower-node v0.87 parity target).
// The check honors YARGS_MIN_NODE_VERSION as an override; set it before
// require() so the throw site sees a permissive bound. None of the
// argv-parsing functionality we exercise here actually needs Node 12.
process.env.YARGS_MIN_NODE_VERSION = "10";

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
