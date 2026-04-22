// j2y: a minimal JSON <-> YAML converter CLI.
//
// Showcases commander (argv) + js-yaml (parse/emit) + fs + optional
// color output via kleur. All synchronous; runs on ionpower-node.
//
// Usage:
//   ionpower-node demos/json2yaml/j2y.js [-r] [-o OUTPUT] INPUT
//     default: JSON -> YAML.
//     -r / --reverse: YAML -> JSON.

var fs   = require("fs");
var path = require("path");
var yaml = require("../../test/vendor/js-yaml.js");
var kleur = require("../../test/vendor/kleur.js");
var program = require("../../test/vendor/commander.js");

program
    .version("0.1.0")
    .usage("[options] INPUT")
    .option("-r, --reverse", "YAML → JSON instead of JSON → YAML")
    .option("-o, --output <file>", "write to FILE instead of stdout")
    .option("-p, --pretty", "pretty-print JSON output (default when direction is JSON)")
    .option("-q, --quiet", "suppress the summary line at the end");

program.parse(process.argv);

if (program.args.length < 1) {
    console.error(kleur.red("error:") + " input file required");
    program.outputHelp && program.outputHelp();
    process.exit(2);
}

var inPath  = program.args[0];
var outPath = program.output;
var reverse = !!program.reverse;
var pretty  = program.pretty || reverse;

if (!fs.existsSync(inPath)) {
    console.error(kleur.red("error:") + " no such file: " + inPath);
    process.exit(2);
}

var src = fs.readFileSync(inPath, "utf8");
var out;
try {
    if (reverse) {
        var obj = yaml.load(src);
        out = JSON.stringify(obj, null, pretty ? 2 : 0);
        if (pretty && out.charAt(out.length - 1) !== "\n") out += "\n";
    } else {
        var obj2 = JSON.parse(src);
        out = yaml.dump(obj2);
    }
} catch (e) {
    console.error(kleur.red("parse error: ") + e.message);
    process.exit(1);
}

if (outPath) {
    fs.writeFileSync(outPath, out);
    if (!program.quiet) {
        console.error(kleur.green("ok: ") + "wrote " + out.length + " bytes to " + outPath);
    }
} else {
    // Write to stdout via console.log (strips trailing newlines, so adjust).
    process.stdout && process.stdout.isTTY
      ? console.log(out.replace(/\n$/, ""))
      : process.stdout_write_replacement
        ? process.stdout_write_replacement(out)
        : console.log(out.replace(/\n$/, ""));
}

if (!program.quiet && !outPath) {
    var direction = reverse ? "YAML → JSON" : "JSON → YAML";
    console.error(kleur.gray("(" + direction + ", " + src.length +
                             " → " + out.length + " bytes)"));
}
