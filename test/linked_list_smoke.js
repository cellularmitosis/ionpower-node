// linked-list: doubly-linked list with Item / List classes.

var ll = require("./vendor/linked-list.js");
var Item = ll.Item, List = ll.List;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var list = new List();
var a = new Item();
var b = new Item();
var c = new Item();

list.append(a).append(b).append(c);

assert(list.head === a, "head is a");
assert(list.tail === c, "tail is c");
assert(list.size === 3, "size 3; got " + list.size);

// toArray order.
var arr = list.toArray();
assert(arr.length === 3 && arr[0] === a && arr[1] === b && arr[2] === c,
       "toArray returns [a, b, c]");
console.log("ok: linked-list append + toArray");

// detach middle.
b.detach();
assert(list.size === 2, "size 2 after detach; got " + list.size);
assert(a.next === c, "a.next === c after detach");
console.log("ok: linked-list detach");

console.log("\nlinked-list smoke: all assertions passed");
