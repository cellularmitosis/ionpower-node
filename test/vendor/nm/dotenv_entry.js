var dotenv = require("dotenv");
var fs     = require("fs");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Write a throwaway .env.
var envPath = "/tmp/ionpower-node-dotenv-test.env";
fs.writeFileSync(envPath, [
    "# a comment",
    "DB_HOST=localhost",
    "DB_PORT=5432",
    "GREETING=\"hello world\"",
    "MULTI=line1\\nline2"
].join("\n"));

// Parse.
var parsed = dotenv.parse(fs.readFileSync(envPath));
assert(parsed.DB_HOST === "localhost", "DB_HOST");
assert(parsed.DB_PORT === "5432",       "DB_PORT");
assert(parsed.GREETING === "hello world", "quoted");
console.log("ok: dotenv.parse");

// Config (reads into process.env).
delete process.env.DB_HOST;
var r = dotenv.config({ path: envPath });
assert(!r.error, "config returns without error");
assert(process.env.DB_HOST === "localhost", "env populated");
console.log("ok: dotenv.config populates process.env");

fs.unlinkSync(envPath);
console.log("\ndotenv smoke: all assertions passed");
