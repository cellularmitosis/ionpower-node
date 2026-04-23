// dagre: directed graph layout (computes x,y for every node).

var dagre = require("./vendor/dagre.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var g = new dagre.graphlib.Graph();
g.setGraph({});
g.setDefaultEdgeLabel(function () { return {}; });

g.setNode("root",   { width: 80, height: 40 });
g.setNode("child1", { width: 80, height: 40 });
g.setNode("child2", { width: 80, height: 40 });
g.setEdge("root", "child1");
g.setEdge("root", "child2");

dagre.layout(g);

// After layout, every node has an x,y coordinate.
var nodes = g.nodes();
assert(nodes.length === 3, "3 nodes");
var root = g.node("root");
assert(typeof root.x === "number" && typeof root.y === "number",
       "root has coords: " + JSON.stringify(root));
var c1 = g.node("child1");
assert(c1.y !== root.y, "child1.y differs from root.y");
console.log("ok: layout positions:", JSON.stringify({ root: [root.x, root.y], c1: [c1.x, c1.y] }));

console.log("\ndagre smoke: all assertions passed");
