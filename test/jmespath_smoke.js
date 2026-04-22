// jmespath: JSON query language (AWS SDK uses it; also standalone).

var jmespath = require("./vendor/jmespath.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var data = {
    people: [
        { name: "alice", age: 30 },
        { name: "bob",   age: 25 },
        { name: "carol", age: 40 }
    ]
};

eq(jmespath.search(data, "people[0].name"), "alice", "index + field");
eq(jmespath.search(data, "people[*].name"), ["alice", "bob", "carol"], "projection");
eq(jmespath.search(data, "people[?age > `28`].name"), ["alice", "carol"], "filter");
eq(jmespath.search(data, "length(people)"), 3, "length fn");
eq(jmespath.search(data, "max_by(people, &age).name"), "carol", "max_by");
console.log("ok: 5 jmespath queries");

console.log("\njmespath smoke: all assertions passed");
