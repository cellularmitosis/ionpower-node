// node:test runner smoke.
//
// Spawns a child script that uses require('node:test') to register
// three tests (pass / pass-async / fail), then inspects the TAP-like
// output.

var child_process = require("child_process");
var fs = require("fs");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var childSrc = [
    "var test = require('node:test');",
    "var assert = require('assert');",
    "test('sync pass', function (t) { assert.strictEqual(2 + 2, 4); });",
    "test('async pass', function (t) { return Promise.resolve().then(function(){ assert.ok(true); }); });",
    "test('should fail', function () { throw new Error('deliberate failure'); });",
    "test.skip('skipped test', function () { throw new Error('should not run'); });",
    "test('nested', function (t) { return t.test('inner', function () { assert.ok(true); }); });"
].join("\n");

var tmp = "/tmp/node_test_child_" + process.pid + ".js";
fs.writeFileSync(tmp, childSrc);

try {
    var nodeBin = process.argv[0];
    var result = child_process.spawnSync(nodeBin, [tmp], { encoding: "utf8" });

    if (result.error) { console.error("FAIL: spawn", result.error); process.exit(1); }

    // One of our tests is deliberately failing, so exit code should be 1.
    assert(result.status === 1, "child should exit 1 with a failing test (got " + result.status + ")");

    var out = result.stdout;
    assert(out.indexOf("TAP version 13") >= 0, "TAP header present");
    assert(out.indexOf("1..5") >= 0, "5 tests planned");
    assert(out.indexOf("ok 1 - sync pass") >= 0, "sync pass");
    assert(out.indexOf("ok 2 - async pass") >= 0, "async pass");
    assert(out.indexOf("not ok 3 - should fail") >= 0, "failure flagged");
    assert(out.indexOf("message: deliberate failure") >= 0, "failure message propagated");
    assert(out.indexOf("# SKIP") >= 0, "skipped test marked SKIP");
    assert(out.indexOf("ok 5 - nested") >= 0, "nested subtest passes");
    assert(out.indexOf("    ok - inner") >= 0, "subtest inner indented");
    assert(out.indexOf("# pass 4") >= 0, "pass count (4: 3 ok + 1 skip)");
    assert(out.indexOf("# fail 1") >= 0, "fail count (1)");
    console.log("ok: node:test runner TAP output");

    // Also verify require('test') + require('node:test') resolve to same module.
    var a = require("node:test");
    var b = require("test");
    assert(a === b, "require('node:test') === require('test')");
    console.log("ok: node: prefix alias");

} finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
}

console.log("\nnode_test smoke: all assertions passed");
