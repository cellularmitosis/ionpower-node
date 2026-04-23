// cronstrue (cron → English) + cron-validator.

var cronstrue      = require("./vendor/cronstrue.js");
var cronValidator  = require("./vendor/cron-validator.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}
function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// cronstrue.
eq(cronstrue.toString("* * * * *"), "Every minute", "every minute");
eq(cronstrue.toString("0 0 * * *"), "At 12:00 AM", "midnight");
var n = cronstrue.toString("0 */2 * * *");
assert(n.indexOf("2 hours") >= 0 || n.indexOf("even") >= 0,
       "every 2 hours prose: " + n);
console.log("ok: cronstrue");

// cron-validator.
assert(cronValidator.isValidCron("* * * * *") === true, "valid simple");
assert(cronValidator.isValidCron("61 * * * *") === false, "minute 61 invalid");
assert(cronValidator.isValidCron("* * * * * *", { seconds: true }) === true, "6-field with seconds");
console.log("ok: cron-validator");

console.log("\ncron smoke: all assertions passed");
