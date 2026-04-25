// process.report + process.kill smoke.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// ---- process.report ----
assert(process.report, "process.report present");
assert(typeof process.report.getReport === "function", "getReport");
assert(typeof process.report.writeReport === "function", "writeReport");

var rep = process.report.getReport();
assert(rep && rep.header, "report.header");
assert(rep.header.processId === process.pid, "header.processId === pid");
assert(rep.header.platform === "darwin", "header.platform = darwin");
assert(rep.header.arch === "ppc", "header.arch = ppc");
assert(rep.header.cwd === process.cwd(), "header.cwd matches");
assert(typeof rep.header.dumpEventTime === "string", "dumpEventTime");
assert(rep.header.commandLine.length > 0, "commandLine populated");

// With an error
var rep2 = process.report.getReport(new Error("test error"));
assert(rep2.header.event === "Exception", "event = Exception with err");
assert(rep2.javascriptStack.message === "test error", "stack message");

console.log("ok: process.report.getReport");

// writeReport to /tmp
var tmp = "/tmp/ion_report_" + process.pid + ".json";
var fn = process.report.writeReport(tmp);
assert(fn === tmp, "writeReport returns filename");
var fs = require("fs");
assert(fs.existsSync(tmp), "report file written");
var parsed = JSON.parse(fs.readFileSync(tmp, "utf8"));
assert(parsed.header && parsed.header.processId, "report file is valid JSON");
fs.unlinkSync(tmp);
console.log("ok: process.report.writeReport");

// ---- process.kill ----
assert(typeof process.kill === "function", "process.kill present");

// Send signal 0 to self — a no-op probe; should succeed.
var ok = process.kill(process.pid, 0);
assert(ok === true, "kill(self, 0) returns true");
console.log("ok: process.kill(self, 0)");

// Kill nonexistent pid — should throw ESRCH
var threw = false;
try { process.kill(999999, 0); } catch (e) {
    threw = true;
    assert(e.code === "ESRCH" || e.errno === 3, "ESRCH on missing pid (got " + e.code + ")");
}
assert(threw, "kill nonexistent throws");
console.log("ok: process.kill nonexistent throws ESRCH");

console.log("\nprocess_report smoke: all assertions passed");
