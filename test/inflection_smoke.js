// inflection: pluralize, camelize, titleize (mirrors ActiveSupport).

var inflection = require("./vendor/inflection.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(inflection.pluralize("fox"), "foxes", "fox -> foxes");
eq(inflection.pluralize("person"), "people", "person -> people");
eq(inflection.singularize("children"), "child", "children -> child");
console.log("ok: plural/singular");

eq(inflection.camelize("post_office"), "PostOffice", "camelize");
eq(inflection.underscore("PostOffice"), "post_office", "underscore");
eq(inflection.titleize("the quick brown fox"), "The Quick Brown Fox", "titleize");
eq(inflection.humanize("user_name"), "User name", "humanize");
console.log("ok: case ops");

console.log("\ninflection smoke: all assertions passed");
