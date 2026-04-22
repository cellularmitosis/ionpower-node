// Hot loop intended to exercise Baseline + Ion. We print elapsed ms
// so --no-ion / --no-baseline comparisons are easy.

function sumTo(n) {
    var total = 0;
    for (var i = 0; i < n; ++i) {
        total = (total + i) | 0;
    }
    return total;
}

var N = 5000000;
var start = Date.now();
var s = sumTo(N);
var end = Date.now();

console.log("sumTo(" + N + ") =", s, "in", (end - start), "ms");
