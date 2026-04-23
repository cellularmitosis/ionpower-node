// longest-streak: find longest run of a given char.

var streak = require("./vendor/longest-streak.js");
streak = streak.longestStreak || streak.default || streak;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(streak("aaa bbbb c", "b"), 4, "'bbbb' in mixed");
eq(streak("hello", "x"), 0, "no matches");
eq(streak("xxxxx", "x"), 5, "all x");
console.log("ok: 3 streaks");

console.log("\nlongest-streak smoke: all assertions passed");
