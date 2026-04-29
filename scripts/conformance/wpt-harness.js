// Minimal WPT testharness.js shim for ionpower-node. Implements the
// subset of testharness API that url/, streams/, encoding/,
// WebCryptoAPI/, and fetch/api/ tests actually use.
//
// Usage:
//   ./node scripts/conformance/wpt-harness.js <test.js> [<test2.js> ...]
//   prints JSON line per test:
//     { "file": "...", "name": "...", "result": "pass" | "fail" | "error",
//       "message": "..." (on fail/error), "stack": "..." (on error) }
//   plus a final summary JSON line:
//     { "file": "...", "summary": { pass: N, fail: M, error: K, total: T,
//                                   timeMs: ... } }
//
// On parse / load failure, emits:
//     { "file": "...", "fatal": true, "message": "...", "stack": "..." }

(function () {
    "use strict";

    var fs = require("fs");
    var path = require("path");
    var vm = (function () {
        try { return require("vm"); } catch (e) { return null; }
    })();

    // ---- Test queue + result state ----
    var queued = [];           // [{ name, fn, kind: 'sync' | 'promise' | 'async', timeoutMs }]
    var currentResults = [];   // [{ name, result, message?, stack? }]

    // ---- assert_* helpers ----
    function _stringify(v) {
        if (v === undefined) return "undefined";
        if (v === null)      return "null";
        if (typeof v === "string") return JSON.stringify(v);
        if (typeof v === "object" && typeof v.message === "string") return v.constructor.name + ": " + v.message;
        try { return String(v); } catch (e) { return "[unstringable]"; }
    }
    function _AssertionError(msg) {
        var e = new Error(msg);
        e.name = "AssertionError";
        return e;
    }
    function assert_true(actual, description) {
        if (actual !== true) throw _AssertionError("assert_true: " +
            (description || "") + " expected true got " + _stringify(actual));
    }
    function assert_false(actual, description) {
        if (actual !== false) throw _AssertionError("assert_false: " +
            (description || "") + " expected false got " + _stringify(actual));
    }
    function _sameValue(a, b) {
        if (a === b) return a !== 0 || 1 / a === 1 / b;        // distinguish +0 / -0
        return a !== a && b !== b;                              // both NaN
    }
    function assert_equals(actual, expected, description) {
        if (!_sameValue(actual, expected)) throw _AssertionError("assert_equals: " +
            (description || "") + " expected " + _stringify(expected) + " got " + _stringify(actual));
    }
    function assert_not_equals(actual, expected, description) {
        if (_sameValue(actual, expected)) throw _AssertionError("assert_not_equals: " +
            (description || "") + " got " + _stringify(actual));
    }
    function assert_array_equals(actual, expected, description) {
        if (!actual || typeof actual.length !== "number")
            throw _AssertionError("assert_array_equals: actual not array-like");
        if (actual.length !== expected.length)
            throw _AssertionError("assert_array_equals: " + (description || "") +
                " length " + actual.length + " != " + expected.length);
        for (var i = 0; i < actual.length; i++)
            if (!_sameValue(actual[i], expected[i]))
                throw _AssertionError("assert_array_equals: " + (description || "") +
                    " at [" + i + "] expected " + _stringify(expected[i]) +
                    " got " + _stringify(actual[i]));
    }
    function _sameObject(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return false;
        if (typeof a !== "object" || typeof b !== "object") return _sameValue(a, b);
        var ka = Object.keys(a), kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        for (var i = 0; i < ka.length; i++) {
            if (kb.indexOf(ka[i]) < 0) return false;
            if (!_sameObject(a[ka[i]], b[ka[i]])) return false;
        }
        return true;
    }
    function assert_object_equals(actual, expected, description) {
        if (!_sameObject(actual, expected))
            throw _AssertionError("assert_object_equals: " + (description || "") +
                " mismatch");
    }
    function assert_throws_js(constructor, fn, description) {
        try { fn(); }
        catch (e) {
            if (e instanceof constructor) return;
            // Some tests pass a name string instead of a constructor.
            if (typeof constructor === "string" && e && e.name === constructor) return;
            throw _AssertionError("assert_throws_js: " + (description || "") +
                " threw " + _stringify(e) + " expected " + (constructor && constructor.name));
        }
        throw _AssertionError("assert_throws_js: " + (description || "") +
            " did not throw");
    }
    function assert_throws_dom(name, fnOrCtor, fnOrDescription, description) {
        // Two signatures: (name, fn, description) or (name, ctor, fn, description).
        var fn = (typeof fnOrCtor === "function" && fnOrCtor.length === 0) ? fnOrCtor : fnOrDescription;
        if (typeof fn !== "function") fn = fnOrCtor;
        try { fn(); }
        catch (e) {
            if (e && (e.name === name || e.code === name)) return;
            throw _AssertionError("assert_throws_dom: expected " + name + " got " + _stringify(e));
        }
        throw _AssertionError("assert_throws_dom: did not throw");
    }
    function assert_throws_exactly(value, fn, description) {
        try { fn(); }
        catch (e) {
            if (e === value) return;
            throw _AssertionError("assert_throws_exactly: " + (description || "") +
                " threw " + _stringify(e) + " not " + _stringify(value));
        }
        throw _AssertionError("assert_throws_exactly: did not throw");
    }
    function assert_unreached(description) {
        throw _AssertionError("assert_unreached: " + (description || ""));
    }
    function assert_in_array(needle, haystack, description) {
        for (var i = 0; i < haystack.length; i++)
            if (_sameValue(haystack[i], needle)) return;
        throw _AssertionError("assert_in_array: " + (description || "") +
            " " + _stringify(needle) + " not in array");
    }
    function assert_approx_equals(actual, expected, epsilon, description) {
        if (Math.abs(actual - expected) > epsilon)
            throw _AssertionError("assert_approx_equals: " + (description || "") +
                " |" + actual + " - " + expected + "| > " + epsilon);
    }
    function assert_class_string(obj, name, description) {
        var s = Object.prototype.toString.call(obj);
        if (s !== "[object " + name + "]")
            throw _AssertionError("assert_class_string: " + (description || "") +
                " got " + s);
    }
    function assert_implements(condition, description) {
        if (!condition)
            throw _AssertionError("assert_implements: " + (description || ""));
    }
    function assert_implements_optional(condition, description) {
        if (!condition) {
            // Skip silently. Mark via a sentinel.
            var e = _AssertionError("PRECONDITION_FAILED");
            e.precondition = true;
            throw e;
        }
    }
    function assert_regexp_match(actual, re, description) {
        if (!re.test(actual))
            throw _AssertionError("assert_regexp_match: " + (description || "") +
                " " + _stringify(actual) + " !~ " + re);
    }

    // Promise-returning assertion helpers commonly imported by streams /
    // fetch / WebCrypto tests.
    function promise_rejects_exactly(t, value, promiseOrFn, description) {
        var p = (typeof promiseOrFn === "function") ? promiseOrFn() : promiseOrFn;
        return Promise.resolve(p).then(
            function () {
                throw _AssertionError("promise_rejects_exactly: " + (description || "") +
                    " did not reject");
            },
            function (e) {
                if (e !== value)
                    throw _AssertionError("promise_rejects_exactly: " + (description || "") +
                        " rejected with " + _stringify(e) + " not " + _stringify(value));
            }
        );
    }
    function promise_rejects_js(t, ctor, promiseOrFn, description) {
        var p = (typeof promiseOrFn === "function") ? promiseOrFn() : promiseOrFn;
        return Promise.resolve(p).then(
            function () {
                throw _AssertionError("promise_rejects_js: " + (description || "") +
                    " did not reject");
            },
            function (e) {
                if (e instanceof ctor) return;
                if (typeof ctor === "string" && e && e.name === ctor) return;
                throw _AssertionError("promise_rejects_js: " + (description || "") +
                    " rejected with " + _stringify(e) +
                    " expected " + (ctor && ctor.name));
            }
        );
    }
    function promise_rejects_dom(t, nameOrCtor, ctorOrFn, fnOrDescription, description) {
        // Two signatures: (t, name, fn[, desc]) or (t, name, ctor, fn[, desc]).
        var fn;
        if (typeof ctorOrFn === "function" && ctorOrFn.length === 0) {
            fn = ctorOrFn; description = fnOrDescription;
        } else { fn = fnOrDescription; }
        var p = (typeof fn === "function") ? fn() : fn;
        return Promise.resolve(p).then(
            function () {
                throw _AssertionError("promise_rejects_dom: " + (description || "") +
                    " did not reject");
            },
            function (e) {
                if (e && (e.name === nameOrCtor || e.code === nameOrCtor)) return;
                throw _AssertionError("promise_rejects_dom: " + (description || "") +
                    " rejected with name=" + (e && e.name) + " expected " + nameOrCtor);
            }
        );
    }

    // Common test-utilities pulled in via various WPT helper files.
    function flushAsyncEvents() {
        // Roll through the microtask queue + a setImmediate.
        return new Promise(function (resolve) {
            Promise.resolve().then(function () {
                setTimeout(resolve, 0);
            });
        });
    }
    function delay(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }
    function garbageCollect() { /* no explicit GC trigger */ }
    function createBuffer(type, len) {
        // Encoding tests pass a typed-array or 'ArrayBuffer'.
        if (type === "ArrayBuffer") return new ArrayBuffer(len);
        var ctors = { Int8Array: Int8Array, Uint8Array: Uint8Array,
                      Int16Array: Int16Array, Uint16Array: Uint16Array,
                      Int32Array: Int32Array, Uint32Array: Uint32Array };
        var c = ctors[type];
        if (c) return new c(len);
        throw new Error("createBuffer: unknown type " + type);
    }
    function fetch_tests_from_worker() { /* no workers — silently skip */ }

    // ---- test()/promise_test()/async_test() ----
    function test(fn, name) {
        queued.push({ name: String(name || "(anonymous)"), fn: fn, kind: "sync" });
    }
    function promise_test(fn, name) {
        queued.push({ name: String(name || "(anonymous)"), fn: fn, kind: "promise" });
    }
    function async_test(fnOrName, name) {
        // Two signatures: async_test(fn, name) or async_test(name) with t.done() called externally.
        var fn = (typeof fnOrName === "function") ? fnOrName : null;
        var nm = (typeof fnOrName === "string") ? fnOrName : (name || "(anonymous)");
        queued.push({ name: String(nm), fn: fn, kind: "async" });
    }
    function setup(opts) { /* ignored — most uses just suppress harness output */ }
    function done() { /* harness-level done; we drive completion from runQueue */ }
    function step_timeout(fn, ms) { return setTimeout(fn, ms); }

    function _testObj(name) {
        return {
            step: function (fn) { return fn(); },
            step_func: function (fn) {
                return function () { return fn.apply(this, arguments); };
            },
            step_func_done: function (fn) {
                var t = this;
                return function () {
                    try { fn.apply(t, arguments); t._done(); }
                    catch (e) { t._fail(e); }
                };
            },
            unreached_func: function (description) {
                return function () { assert_unreached(description); };
            },
            done: function () { /* set externally */ },
            add_cleanup: function () {},
            add_event_listener: function () {},
            name: name
        };
    }

    // ---- Run queue ----
    function _record(name, result, err) {
        var rec = { name: name, result: result };
        if (err) {
            rec.message = (err && err.message) || String(err);
            if (err.stack) rec.stack = err.stack;
            if (err.precondition) rec.precondition = true;
        }
        currentResults.push(rec);
    }

    function _runOne(entry) {
        return new Promise(function (resolve) {
            if (entry.kind === "sync") {
                try { entry.fn(_testObj(entry.name)); _record(entry.name, "pass"); }
                catch (e) {
                    if (e && e.precondition) _record(entry.name, "skip", e);
                    else                      _record(entry.name, "fail", e);
                }
                resolve();
                return;
            }
            if (entry.kind === "promise") {
                try {
                    var p = entry.fn(_testObj(entry.name));
                    if (p && typeof p.then === "function") {
                        var settled = false;
                        var to = setTimeout(function () {
                            if (settled) return; settled = true;
                            _record(entry.name, "fail", _AssertionError("timeout (5000 ms)"));
                            resolve();
                        }, 5000);
                        p.then(
                            function () {
                                if (settled) return; settled = true;
                                clearTimeout(to);
                                _record(entry.name, "pass");
                                resolve();
                            },
                            function (e) {
                                if (settled) return; settled = true;
                                clearTimeout(to);
                                if (e && e.precondition) _record(entry.name, "skip", e);
                                else                      _record(entry.name, "fail", e);
                                resolve();
                            }
                        );
                    } else {
                        _record(entry.name, "pass");
                        resolve();
                    }
                } catch (e) {
                    if (e && e.precondition) _record(entry.name, "skip", e);
                    else                      _record(entry.name, "fail", e);
                    resolve();
                }
                return;
            }
            if (entry.kind === "async") {
                if (!entry.fn) {
                    _record(entry.name, "fail", _AssertionError("no fn"));
                    resolve();
                    return;
                }
                var t = _testObj(entry.name);
                var settled = false;
                t.done = function () {
                    if (settled) return; settled = true;
                    _record(entry.name, "pass");
                    resolve();
                };
                t._done = t.done;
                t._fail = function (e) {
                    if (settled) return; settled = true;
                    _record(entry.name, "fail", e);
                    resolve();
                };
                var to = setTimeout(function () {
                    if (settled) return; settled = true;
                    _record(entry.name, "fail", _AssertionError("async_test timeout"));
                    resolve();
                }, 5000);
                try { entry.fn(t); }
                catch (e) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(to);
                    _record(entry.name, "fail", e);
                    resolve();
                }
                return;
            }
        });
    }

    function _runQueue() {
        var p = Promise.resolve();
        queued.forEach(function (e) { p = p.then(function () { return _runOne(e); }); });
        return p;
    }

    // ---- format() ----
    function format_value(v) { return _stringify(v); }

    // ---- subsetTestByKey: just call the test fn, ignore the key filter ----
    function subsetTestByKey(key, testFn /* ...args */) {
        var args = Array.prototype.slice.call(arguments, 2);
        return testFn.apply(null, args);
    }
    function shouldRunSubTest() { return true; }
    function get_current_url_components() { return []; }

    // Install everything on globalThis
    var harness = {
        test: test,
        promise_test: promise_test,
        async_test: async_test,
        setup: setup,
        done: done,
        step_timeout: step_timeout,
        assert_true: assert_true,
        assert_false: assert_false,
        assert_equals: assert_equals,
        assert_not_equals: assert_not_equals,
        assert_array_equals: assert_array_equals,
        assert_object_equals: assert_object_equals,
        assert_throws_js: assert_throws_js,
        assert_throws_dom: assert_throws_dom,
        assert_throws_exactly: assert_throws_exactly,
        assert_unreached: assert_unreached,
        assert_in_array: assert_in_array,
        assert_approx_equals: assert_approx_equals,
        assert_class_string: assert_class_string,
        assert_implements: assert_implements,
        assert_implements_optional: assert_implements_optional,
        assert_regexp_match: assert_regexp_match,
        promise_rejects_exactly: promise_rejects_exactly,
        promise_rejects_js: promise_rejects_js,
        promise_rejects_dom: promise_rejects_dom,
        flushAsyncEvents: flushAsyncEvents,
        delay: delay,
        garbageCollect: garbageCollect,
        createBuffer: createBuffer,
        fetch_tests_from_worker: fetch_tests_from_worker,
        format_value: format_value,
        subsetTestByKey: subsetTestByKey,
        shouldRunSubTest: shouldRunSubTest,
        get_current_url_components: get_current_url_components
    };
    Object.keys(harness).forEach(function (k) { globalThis[k] = harness[k]; });

    // Also make `self` an alias for globalThis (many WPT tests reference self).
    if (typeof globalThis.self === "undefined") globalThis.self = globalThis;

    // ---- Driver ----
    function runFile(file) {
        queued = [];
        currentResults = [];
        var t0 = Date.now();
        try {
            var src = fs.readFileSync(file, "utf8");
            // META: script=/x/y.js  ->  load and prepend
            var preludes = [];
            src.split("\n").slice(0, 50).forEach(function (line) {
                var m = /^\/\/\s*META:\s*script=(\S+)/.exec(line);
                if (m) {
                    var rel = m[1];
                    var base = path.join(__dirname, "..", "..", "external", "wpt");
                    var p = rel.charAt(0) === "/" ? path.join(base, rel) : path.join(path.dirname(file), rel);
                    if (fs.existsSync(p)) {
                        try { preludes.push(fs.readFileSync(p, "utf8")); } catch (e) {}
                    }
                }
            });
            var combined = preludes.join("\n;\n") + "\n;\n" + src;

            // Wrap in IIFE so let/const at top level is OK; eval into global scope.
            // On SyntaxError (typically async functions, which the SM45
            // parser rejects), fall back to require() which goes through
            // the bootstrap's Babel-on-parse-failure path.
            var wrapped = "(function(){ " + combined + " })()";
            try {
                (0, eval)(wrapped);
            } catch (parseErr) {
                if (parseErr instanceof SyntaxError ||
                    /SyntaxError|async functions|let|const|=>/.test(String(parseErr && parseErr.message))) {
                    // Drop the IIFE wrap; require'd files have their own
                    // CJS wrapper so let/const/async work at top level.
                    var os = require("os");
                    // Use a unique-per-call temp file name so we never
                    // hit require's cache. Our runtime's require cache
                    // is keyed by abs path; brand-new path = brand-new load.
                    var tmp = path.join(os.tmpdir(),
                        "wpt-" + process.pid + "-" + Date.now() +
                        "-" + Math.floor(Math.random() * 1e9) + ".js");
                    fs.writeFileSync(tmp, combined);
                    try {
                        require(tmp);
                    } finally {
                        try { fs.unlinkSync(tmp); } catch (e) {}
                    }
                } else {
                    throw parseErr;
                }
            }
        } catch (e) {
            console.log(JSON.stringify({
                file: file, fatal: true,
                message: (e && e.message) || String(e),
                stack: (e && e.stack) || null
            }));
            return Promise.resolve();
        }
        return _runQueue().then(function () {
            var pass = 0, fail = 0, skip = 0, error = 0;
            currentResults.forEach(function (r) {
                if (r.result === "pass") pass++;
                else if (r.result === "skip") skip++;
                else fail++;
            });
            currentResults.forEach(function (r) {
                console.log(JSON.stringify({ file: file, test: r }));
            });
            console.log(JSON.stringify({
                file: file,
                summary: { pass: pass, fail: fail, skip: skip, total: currentResults.length, timeMs: Date.now() - t0 }
            }));
        }, function (e) {
            console.log(JSON.stringify({
                file: file, fatal: true,
                message: (e && e.message) || String(e),
                stack: (e && e.stack) || null
            }));
        });
    }

    // ---- Entry point ----
    var files = process.argv.slice(2);
    if (files.length === 0) {
        console.error("usage: ./node wpt-harness.js <test.js> [<test2.js> ...]");
        process.exit(2);
    }
    var p = Promise.resolve();
    files.forEach(function (f) { p = p.then(function () { return runFile(f); }); });
    p.then(function () { process.exit(0); }, function () { process.exit(1); });
})();
