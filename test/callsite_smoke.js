// Smoke: V8-style Error.captureStackTrace + Error.prepareStackTrace +
// CallSite API. depd, mocha, sinon, jest and friends use the idiom:
//
//   var obj = {};
//   var prep = Error.prepareStackTrace;
//   Error.prepareStackTrace = function (err, stack) { return stack; };
//   Error.captureStackTrace(obj);
//   var frames = obj.stack;            // <-- Array<CallSite>
//   Error.prepareStackTrace = prep;
//
// Each frame must expose getFileName, getLineNumber, getColumnNumber,
// getFunctionName at minimum (plus isEval / getEvalOrigin / etc.).

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// ---- 1. Default formatting (no prepareStackTrace) returns a string.
function defaultFmt() {
    var obj = {};
    Error.captureStackTrace(obj);
    return obj.stack;
}
var s = defaultFmt();
assert(typeof s === 'string', "default stack should be string, got " + typeof s);
assert(s.indexOf('at ') >= 0, "default stack should contain 'at ' frames; got: " + s);

// ---- 2. With prepareStackTrace, obj.stack returns the raw frame array.
function captureFrames() {
    var obj = {};
    var prep = Error.prepareStackTrace;
    Error.prepareStackTrace = function (err, frames) { return frames; };
    Error.captureStackTrace(obj);
    var frames = obj.stack;
    Error.prepareStackTrace = prep;
    return frames;
}

var frames = captureFrames();
assert(Array.isArray(frames), "frames should be array, got " + Object.prototype.toString.call(frames));
assert(frames.length > 0, "frames should be non-empty");

var f0 = frames[0];
assert(typeof f0.getFileName === 'function', "frame should have getFileName()");
assert(typeof f0.getLineNumber === 'function', "frame should have getLineNumber()");
assert(typeof f0.getColumnNumber === 'function', "frame should have getColumnNumber()");
assert(typeof f0.getFunctionName === 'function', "frame should have getFunctionName()");
assert(typeof f0.isEval === 'function', "frame should have isEval()");
assert(typeof f0.getEvalOrigin === 'function', "frame should have getEvalOrigin()");
assert(typeof f0.isToplevel === 'function', "frame should have isToplevel()");
assert(typeof f0.isNative === 'function', "frame should have isNative()");
assert(typeof f0.isConstructor === 'function', "frame should have isConstructor()");
assert(typeof f0.getMethodName === 'function', "frame should have getMethodName()");
assert(typeof f0.getTypeName === 'function', "frame should have getTypeName()");
assert(typeof f0.getThis === 'function', "frame should have getThis()");
assert(typeof f0.getFunction === 'function', "frame should have getFunction()");

// ---- 3. The top frame after captureStackTrace should be inside captureFrames
// (V8 drops the capture call itself). getFunctionName() returns 'captureFrames'.
assert(f0.getFunctionName() === 'captureFrames',
    "top frame should be captureFrames, got: " + f0.getFunctionName());

var fn = f0.getFileName();
assert(typeof fn === 'string' && fn.indexOf('callsite_smoke') >= 0,
    "getFileName should return the test file path; got: " + fn);
assert(typeof f0.getLineNumber() === 'number' && f0.getLineNumber() > 0,
    "getLineNumber should be a positive integer");
assert(typeof f0.getColumnNumber() === 'number',
    "getColumnNumber should be a number");

// ---- 4. constructorOpt: frames at and above the named function are dropped.
function Inner() {
    var obj = {};
    var prep = Error.prepareStackTrace;
    Error.prepareStackTrace = function (e, f) { return f; };
    Error.captureStackTrace(obj, Inner);
    // Read obj.stack BEFORE restoring prepareStackTrace — V8 evaluates
    // the lazy stack accessor on first read, not at capture time.
    var s = obj.stack;
    Error.prepareStackTrace = prep;
    return s;
}
var innerFrames = Inner();
// 'Inner' itself should be excluded from the frame list.
for (var i = 0; i < innerFrames.length; i++) {
    assert(innerFrames[i].getFunctionName() !== 'Inner',
        "Inner frame should have been dropped via constructorOpt; idx " + i);
}

// ---- 5. depd-shaped use: callSiteLocation pattern.
function callSiteLocation(callSite) {
    var file = callSite.getFileName() || '<anonymous>';
    var line = callSite.getLineNumber();
    var colm = callSite.getColumnNumber();
    if (callSite.isEval()) {
        file = callSite.getEvalOrigin() + ', ' + file;
    }
    var site = [file, line, colm];
    site.callSite = callSite;
    site.name = callSite.getFunctionName();
    return site;
}
var loc = callSiteLocation(frames[0]);
assert(Array.isArray(loc) && loc.length === 3, "site should be [file,line,col]");
assert(loc[0].indexOf('callsite_smoke') >= 0, "site[0] should be filename");
assert(typeof loc[1] === 'number' && loc[1] > 0, "site[1] should be lineNum");
assert(loc.name === 'captureFrames', "site.name should be 'captureFrames'");

// ---- 6. err.stack getter caches (V8 evaluates once and remembers).
function cacheTest() {
    var obj = {};
    var callCount = 0;
    var prep = Error.prepareStackTrace;
    Error.prepareStackTrace = function (err, frames) { callCount++; return frames; };
    Error.captureStackTrace(obj);
    var a = obj.stack;
    var b = obj.stack;
    Error.prepareStackTrace = prep;
    assert(callCount === 1,
        "prepareStackTrace should be called once; got " + callCount);
    assert(a === b, "repeated obj.stack reads should return identical value");
}
cacheTest();

// ---- 7. Setting err.stack overrides the lazy getter.
function setterTest() {
    var obj = {};
    var prep = Error.prepareStackTrace;
    Error.prepareStackTrace = function (e, f) { return f; };
    Error.captureStackTrace(obj);
    obj.stack = 'overridden';
    Error.prepareStackTrace = prep;
    assert(obj.stack === 'overridden', "setter should override; got: " + obj.stack);
}
setterTest();

console.log("callsite_smoke: all assertions passed");
