// node:test before/after/beforeEach/afterEach hooks smoke.

var fs = require("fs");
var child_process = require("child_process");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var childSrc = [
    "var test = require('node:test');",
    "var calls = [];",
    "test.before(function () { calls.push('before'); });",
    "test.after(function () { calls.push('after'); console.log('order:', calls.join(',')); });",
    "test.beforeEach(function () { calls.push('beforeEach'); });",
    "test.afterEach(function () { calls.push('afterEach'); });",
    "test('one', function () { calls.push('one'); });",
    "test('two', function () { calls.push('two'); });"
].join("\n");

var tmp = "/tmp/test_hooks_child_" + process.pid + ".js";
fs.writeFileSync(tmp, childSrc);

try {
    var nodeBin = process.argv[0];
    var result = child_process.spawnSync(nodeBin, [tmp], { encoding: "utf8" });
    if (result.error) { console.error("FAIL: spawn", result.error); process.exit(1); }
    if (result.status !== 0) {
        console.error("FAIL: child exit", result.status, "stderr:", result.stderr);
        process.exit(1);
    }

    var out = result.stdout;
    // Expected order:
    // before, beforeEach, one, afterEach, beforeEach, two, afterEach, after
    var expectedOrder = "before,beforeEach,one,afterEach,beforeEach,two,afterEach,after";
    assert(out.indexOf("order: " + expectedOrder) >= 0,
           "hook order: expected '" + expectedOrder + "' in:\n" + out);
    console.log("ok: node:test before/after/beforeEach/afterEach order");

    // Both tests should still pass and TAP plan should still be ok
    assert(out.indexOf("ok 1 - one") >= 0, "test 'one' passed");
    assert(out.indexOf("ok 2 - two") >= 0, "test 'two' passed");
    assert(out.indexOf("# pass 2") >= 0, "pass count = 2");
    console.log("ok: hooks don't break TAP output");

} finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
}

console.log("\nnode_test_hooks smoke: all assertions passed");
