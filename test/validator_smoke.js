// Smoke test: validator 13.x (string validators/sanitizers) on
// ionpower-node.
var validator = require("./vendor/validator.js");
// UMD export shape: may put functions under .default or as loose members.
if (validator.default && !validator.isEmail) validator = validator.default;

function ok(label, cond) {
    if (cond) console.log("ok: " + label);
    else { console.error("FAIL: " + label); process.exit(1); }
}

ok("isEmail good",    validator.isEmail("x@y.com"));
ok("isEmail bad",    !validator.isEmail("x@@y"));
ok("isURL good",      validator.isURL("https://example.com/path"));
ok("isURL bad",      !validator.isURL("htp//broken"));
ok("isUUID v4",       validator.isUUID("12345678-1234-4321-8abc-1234567890ab"));
ok("isHex",           validator.isHexColor("#ff0088"));
ok("isInt",           validator.isInt("42"));
ok("isFloat",         validator.isFloat("3.14"));
ok("isNumeric",       validator.isNumeric("12345"));
ok("isAlpha",         validator.isAlpha("hello"));
ok("isBase64",        validator.isBase64("SGVsbG8="));
ok("isIP v4",         validator.isIP("192.168.1.1", 4));
ok("isIP v6",         validator.isIP("::1", 6));
ok("isJSON good",     validator.isJSON('{"a":1}'));
ok("isJSON bad",     !validator.isJSON("nope"));

// Sanitizers.
var x = validator.escape("<h1>hi</h1>");
console.log("escape:", JSON.stringify(x));
ok("escape produces entities", x.indexOf("&lt;") >= 0);

var y = validator.trim("   hello   ");
ok("trim", y === "hello");

console.log("\nvalidator smoke: all assertions passed");
