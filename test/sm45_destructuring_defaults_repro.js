// SpiderMonkey 45 bug reproducer.
//
// A destructuring-default expression that references a sibling
// `var`/`let`/`const` in the SAME function throws ReferenceError,
// as if the sibling binding is not in scope.
//
// Reproduced on the stock SpiderMonkey 45 `js` shell as well as
// ionpower-node, so this is a VM-level bug, not a bridge bug.
//
// Example that fails:
//     (function () {
//         var outer = 42;
//         var { inner = outer } = {};   // ReferenceError: outer is not defined
//     })();
//
// Workaround in affected libraries:
//     const x = opts.x;
//     const finalX = x === undefined ? defaultX : x;
//
// Real-world impact observed so far:
//     * cli-table3 src/cell.js:76 — ships with this idiom; load fails.
//
// Note: `eval()` of the same code DOES work — the bug is in the
// non-eval parse/compile path only. Make this test exit 0 after
// confirming the behavior, since it's documentation, not a defect
// our code can fix.

var saw_error = false;
var err = null;
try {
    (function () {
        var outer = 42;
        var { inner = outer } = {};  // the bug
        // If we ever get here, SpiderMonkey's been fixed.
        console.log("unexpected: got inner =", inner, "; SM45 bug may be gone");
    })();
} catch (e) {
    saw_error = true;
    err = e;
}

if (saw_error && /ReferenceError.*outer.*not defined/.test(err.toString())) {
    console.log("ok: confirmed SM45 destructuring-default scope bug");
    console.log("    (" + err.toString() + ")");
} else if (!saw_error) {
    console.log("BUG APPEARS FIXED — SM45 accepted the idiom.");
    console.log("Time to retry cli-table3 etc.");
} else {
    console.error("unexpected error:", err);
    process.exit(1);
}
