// Exercises console.log's object-formatting behavior.
//
// ionpower-node's console.log uses JSON.stringify(..., null, 2) for
// plain objects and arrays, and "[Function: name]" for functions.
// Not identical to Node's util.inspect output (no colors, no cycle
// detection, Map/Set keys rendered as [object Map] etc.) but close
// enough for everyday logging.

console.log("primitive:", 42, true, null, undefined);
console.log("string:", "hello");

console.log("object:", { a: 1, b: "two", c: [1, 2, 3] });

console.log("array:", [10, 20, 30]);

console.log("nested:", { outer: { inner: { leaf: "yes" } } });

console.log("function:", function foo() { return 1; });

console.log("anon function:", function () {});

console.log("arrow (named via decl):", (function bar() { return 2; }));

// Mixed:
const user = { name: "alice", pid: process.pid, platform: process.platform };
console.log("user record:", user);

console.warn("warn goes to stderr:", { level: "warn" });
