// graphlib: directed graph data structure (dagre dep).

var graphlib = require("./vendor/graphlib.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var g = new graphlib.Graph();
g.setNode("a"); g.setNode("b"); g.setNode("c");
g.setEdge("a", "b"); g.setEdge("b", "c"); g.setEdge("a", "c");

assert(g.nodeCount() === 3, "3 nodes");
assert(g.edgeCount() === 3, "3 edges");
console.log("ok: build graph");

// Check successor lookup.
var succ = g.successors("a").sort();
assert(succ.length === 2 && succ[0] === "b" && succ[1] === "c",
       "successors of a: " + succ);
console.log("ok: successors");

// Topological sort.
var order = graphlib.alg.topsort(g);
assert(order.indexOf("a") < order.indexOf("b"), "a before b");
assert(order.indexOf("b") < order.indexOf("c"), "b before c");
console.log("ok: topsort:", order);

// Shortest path (Dijkstra).
var paths = graphlib.alg.dijkstra(g, "a", null);
assert(paths.c && paths.c.distance <= 2, "a->c dist <= 2");
console.log("ok: dijkstra");

console.log("\ngraphlib smoke: all assertions passed");
