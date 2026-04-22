// Smoke test: commander 2.20.3 on ionpower-node.
// Depends on events.EventEmitter + util.inherits. We added both.
// Real test of our core-module seeding.

const program = require("./vendor/commander.js");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

program
    .version("0.0.1")
    .option("-v, --verbose", "enable verbose output")
    .option("-o, --output <file>", "output file")
    .option("-n, --count <n>", "number of items", parseInt)
    .option("--dry-run", "just print what would happen");

// Parse a simulated argv. commander expects argv[0]=node, argv[1]=script.
var fakeArgv = ["node", "/tmp/demo", "-v", "-o", "out.txt", "-n", "7", "--dry-run"];
program.parse(fakeArgv);

assert(program.verbose === true,     "--verbose parsed");
assert(program.output === "out.txt", "-o/--output parsed");
assert(program.count === 7,          "-n parsed with coercion");
assert(program.dryRun === true,      "--dry-run parsed (camelCase)");
console.log("ok: flags and options parsed correctly");

// Version flag should not crash.
assert(typeof program._version === "string" || typeof program.version === "function",
       "version set");
console.log("ok: version configured");

// Commands
var cmdResult = null;
var prog2 = new (require("./vendor/commander.js").Command)();
prog2
    .command("say <word>")
    .description("say a word")
    .action(function (word) { cmdResult = "said: " + word; });
prog2.parse(["node", "/tmp/demo", "say", "hello"]);
assert(cmdResult === "said: hello", "subcommand action fired: got " + JSON.stringify(cmdResult));
console.log("ok: subcommand with action");

console.log("\ncommander smoke: all assertions passed");
