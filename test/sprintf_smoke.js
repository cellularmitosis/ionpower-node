var sp = require("./vendor/sprintf.js");
var sprintf = sp.sprintf || sp;

function eq(label, got, want) {
    if (got === want) console.log("ok: " + label + " -> " + JSON.stringify(got));
    else { console.error("FAIL: " + label + " got " + JSON.stringify(got) + " want " + JSON.stringify(want)); process.exit(1); }
}

eq("string",     sprintf("%s world", "hello"),       "hello world");
eq("int",        sprintf("count=%d",   42),           "count=42");
eq("hex",        sprintf("0x%x", 255),                "0xff");
eq("padding",    sprintf("%05d", 7),                   "00007");
eq("left-align", sprintf("|%-10s|", "hi"),             "|hi        |");
eq("named",      sprintf("%(who)s is %(n)d", { who: "PPC", n: 42 }), "PPC is 42");
eq("literal pct",sprintf("%% done"),                    "% done");
eq("float",      sprintf("%.2f", 3.14159),              "3.14");

console.log("\nsprintf-js smoke: all assertions passed");
