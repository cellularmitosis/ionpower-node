// A vendored module that exercises ES2021 logical-assignment operators
// (||=, &&=, ??=) which SM45 cannot parse natively. Loading this module
// requires the Babel-on-parse-failure fallback to lower the operators
// before the source is re-evaluated.
//
// Triggered by test/babel_logical_assignment_smoke.js. Closure Library
// output emitted by ClojureScript :advanced builds occasionally contains
// a single one of these — see lumo-darwin8-ppc session 001 for the
// real-world case that surfaced the gap.

function orAssign(initial, fallback) {
    var x = initial;
    x ||= fallback;
    return x;
}

function andAssign(initial, replacement) {
    var x = initial;
    x &&= replacement;
    return x;
}

function nullishAssign(initial, fallback) {
    var x = initial;
    x ??= fallback;
    return x;
}

module.exports = {
    orAssign:      orAssign,
    andAssign:     andAssign,
    nullishAssign: nullishAssign,
};
