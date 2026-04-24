// util.promisify + util.types + util.isXxx smoke.
// v0.11: util.promisify uses Promises (microtask-queued), so the async
// cases are checked in exit handler.

var util = require("util");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// util.promisify: Node-style callback -> Promise. Microtask-queued now.
var addCb = function (a, b, cb) { cb(null, a + b); };
var addP = util.promisify(addCb);
var got = null;
addP(2, 3).then(function (v) { got = v; });

var errCb = function (cb) { cb(new Error("fail")); };
var errP = util.promisify(errCb);
var rej = null;
errP().catch(function (e) { rej = e.message; });

// Custom-symbol opt-out — synchronous check is fine.
var custom = function () { return "custom"; };
var customized = function () {};
customized[util.promisify.custom] = custom;
assert(util.promisify(customized) === custom, "custom symbol honored");
console.log("ok: util.promisify.custom symbol");

// util.callbackify: the reverse.
var asyncAdd = function (a, b) { return Promise.resolve(a + b); };
var cbAdd = util.callbackify(asyncAdd);
var result = null;
cbAdd(10, 20, function (err, v) { result = v; });

// util.types.*
assert(util.types.isDate(new Date()),         "isDate");
assert(util.types.isRegExp(/./),              "isRegExp");
assert(util.types.isPromise(Promise.resolve()), "isPromise");
assert(util.types.isMap(new Map()),           "isMap");
assert(util.types.isSet(new Set()),           "isSet");
assert(util.types.isNativeError(new Error()), "isNativeError");
assert(util.types.isArrayBuffer(new ArrayBuffer(1)), "isArrayBuffer");
assert(util.types.isUint8Array(new Uint8Array(1)),   "isUint8Array");
assert(util.types.isTypedArray(new Float32Array(1)), "isTypedArray");
console.log("ok: util.types (9 predicates)");

// util.isXxx (legacy top-level aliases).
assert(util.isArray([]),          "isArray");
assert(util.isString("x"),        "isString");
assert(util.isNumber(42),         "isNumber");
assert(util.isBoolean(true),      "isBoolean");
assert(util.isFunction(function(){}), "isFunction");
assert(util.isObject({}),         "isObject");
assert(util.isNull(null),         "isNull");
assert(util.isUndefined(undefined), "isUndefined");
assert(util.isNullOrUndefined(null), "isNullOrUndefined null");
assert(util.isNullOrUndefined(undefined), "isNullOrUndefined undefined");
assert(util.isError(new Error()), "isError");
assert(util.isPrimitive(42),      "isPrimitive 42");
assert(!util.isPrimitive({}),     "isPrimitive !{}");
console.log("ok: util.isXxx legacy aliases (13)");

process.on("exit", function () {
    assert(got === 5,           "promisify resolve: " + got);
    assert(rej === "fail",      "promisify reject: " + rej);
    console.log("ok: util.promisify (resolve + reject)");
    assert(result === 30,       "callbackify resolve: " + result);
    console.log("ok: util.callbackify");
    console.log("\nutil_helpers smoke: all assertions passed");
});
