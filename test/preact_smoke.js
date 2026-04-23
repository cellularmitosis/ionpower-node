// Preact: 3KB React-alike. We can't DOM-render without a DOM, but we
// can exercise h(), createElement(), and the string-rendering piece of
// cloneElement and Fragment as a smoke check.

var preact = require("./vendor/preact.js");
var h = preact.h || preact.createElement;
var Fragment = preact.Fragment;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var vnode = h("div", { id: "root", class: "box" },
    h("span", null, "hi "),
    h("b", null, "there")
);

assert(vnode && vnode.type === "div", "root vnode type div");
assert(vnode.props && vnode.props.id === "root", "id prop");
assert(Array.isArray(vnode.props.children), "children is array");
assert(vnode.props.children.length === 2, "2 children: " + vnode.props.children.length);
console.log("ok: h() / createElement");

// Fragment.
var f = h(Fragment, null, h("p", null, "a"), h("p", null, "b"));
assert(f.type === Fragment, "fragment type");
console.log("ok: Fragment");

// cloneElement.
var cloned = preact.cloneElement(vnode, { id: "changed" });
assert(cloned.props.id === "changed", "cloneElement override");
console.log("ok: cloneElement");

console.log("\npreact smoke: all assertions passed");
