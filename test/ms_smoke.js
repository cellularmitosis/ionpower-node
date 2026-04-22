// Smoke test: ms (duration parser/formatter) on ionpower-node.
const ms = require("./vendor/ms.js");

function eq(label, got, want) {
    if (got === want) { console.log("ok: " + label); }
    else { console.error("FAIL: " + label + "\n  got:  " + got +
                                        "\n  want: " + want); process.exit(1); }
}

// Parse.
eq("parse 2h",       ms("2h"),        2 * 60 * 60 * 1000);
eq("parse 1m",       ms("1m"),        60000);
eq("parse 1.5h",     ms("1.5h"),      90 * 60 * 1000);
eq("parse 100ms",    ms("100ms"),     100);
eq("parse 1d",       ms("1d"),        24 * 60 * 60 * 1000);
eq("parse '2 days'", ms("2 days"),    2 * 24 * 60 * 60 * 1000);

// Format.
eq("format 60000",    ms(60000),              "1m");
eq("format 1200",     ms(1200),               "1s");
eq("format 90000 long", ms(90000, { long: true }), "2 minutes");   // ms rounds to nearest
eq("format 2h long",  ms(7200000, { long: true }), "2 hours");
eq("format 1d long",  ms(86400000, { long: true }), "1 day");

console.log("\nms smoke: all assertions passed");
