// tslib: TypeScript helpers (__extends, __assign, __awaiter, etc.)

var tslib = require("./vendor/tslib.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// __assign merges objects (like Object.assign).
var out = tslib.__assign({}, { a: 1 }, { b: 2 });
assert(out.a === 1 && out.b === 2, "__assign: " + JSON.stringify(out));
console.log("ok: __assign");

// __spreadArray joins arrays.
var arr = tslib.__spreadArray([1, 2], [3, 4], true);
assert(arr.length === 4 && arr[3] === 4, "__spreadArray: " + arr);
console.log("ok: __spreadArray");

// __extends builds a prototype chain.
function Animal(name) { this.name = name; }
Animal.prototype.speak = function () { return "???"; };
function Dog(name) { Animal.call(this, name); }
tslib.__extends(Dog, Animal);
Dog.prototype.speak = function () { return "woof (" + this.name + ")"; };
var d = new Dog("Rex");
assert(d.speak() === "woof (Rex)", "extended method");
assert(d instanceof Animal, "instanceof Animal");
console.log("ok: __extends");

console.log("\ntslib smoke: all assertions passed");
