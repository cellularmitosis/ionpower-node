// cluster: single-process degenerate stub.

var cluster = require("cluster");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Shape: master/primary half always wins.
assert(cluster.isMaster === true, "isMaster");
assert(cluster.isPrimary === true, "isPrimary");
assert(cluster.isWorker === false, "isWorker");
assert(cluster.worker === undefined, "worker undefined");
assert(typeof cluster.workers === "object", "workers map");
assert(typeof cluster.fork === "function", "fork is fn");
assert(cluster.SCHED_RR === 2, "SCHED_RR");
console.log("ok: cluster master-half shape");

// fork() throws (we have no worker model).
var threw = false;
try { cluster.fork(); } catch (e) { threw = true; }
assert(threw, "cluster.fork throws");
console.log("ok: cluster.fork rejects");

// EventEmitter surface intact.
assert(typeof cluster.on === "function", "cluster is an EventEmitter");
console.log("ok: cluster is EventEmitter");

// setupMaster / setupPrimary — both exist.
cluster.setupMaster({ exec: "/dev/null" });
assert(cluster.settings.exec === "/dev/null", "setupMaster recorded");
cluster.setupPrimary({ exec: "/another" });
assert(cluster.settings.exec === "/another", "setupPrimary recorded");
console.log("ok: setupMaster / setupPrimary");

// disconnect with callback fires it.
var disconnectFired = false;
cluster.disconnect(function () { disconnectFired = true; });
setImmediate(function () {
    assert(disconnectFired, "disconnect callback fired");
    console.log("ok: cluster.disconnect (single-process)");
    console.log("\ncluster stub smoke: all assertions passed");
});
