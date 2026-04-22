// Smoke test: ajv 6.12.6 (JSON Schema validator) on ionpower-node.
// Compiles schemas to JS functions via `new Function(...)`, like
// handlebars. Heavy runtime codegen workload.

const Ajv = require("./vendor/ajv.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var ajv = new Ajv({ allErrors: true });

// 1. Simple object schema with types and required fields.
var schema1 = {
    type: "object",
    required: ["name", "age"],
    properties: {
        name: { type: "string", minLength: 1 },
        age:  { type: "integer", minimum: 0, maximum: 150 },
        tags: { type: "array", items: { type: "string" } }
    },
    additionalProperties: false
};
var v1 = ajv.compile(schema1);

assert(v1({ name: "alice", age: 30 })         === true, "valid minimal");
assert(v1({ name: "alice", age: 30, tags: ["a","b"] }) === true, "valid with tags");
assert(v1({ name: "", age: 30 })              === false, "invalid empty name");
assert(v1.errors && v1.errors[0].keyword === "minLength", "error keyword for bad name");
assert(v1({ name: "bob", age: -5 })           === false, "invalid negative age");
assert(v1({ name: "bob", age: 200 })          === false, "invalid over-max age");
assert(v1({ age: 30 })                        === false, "missing required field");
assert(v1({ name: "ok", age: 30, extra: 1 }) === false, "additional property");
console.log("ok: object schema (8 cases)");

// 2. Nested schema with $ref.
var schema2 = {
    definitions: {
        point: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" } },
            required: ["x", "y"]
        }
    },
    type: "object",
    properties: {
        start: { "$ref": "#/definitions/point" },
        end:   { "$ref": "#/definitions/point" }
    },
    required: ["start", "end"]
};
var v2 = ajv.compile(schema2);
assert(v2({ start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }) === true, "nested valid");
assert(v2({ start: { x: 0 },       end: { x: 1, y: 1 } }) === false, "nested invalid ($ref)");
console.log("ok: nested $ref schema");

// 3. Array schema with uniqueItems.
var schema3 = {
    type: "array", items: { type: "integer" }, uniqueItems: true, minItems: 1
};
var v3 = ajv.compile(schema3);
assert(v3([1, 2, 3])    === true,  "unique ok");
assert(v3([1, 2, 2])    === false, "duplicate fail");
assert(v3([])           === false, "empty fails minItems");
console.log("ok: array + uniqueItems");

console.log("\najv smoke: all assertions passed");
