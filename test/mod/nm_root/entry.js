// Entry point for the node_modules resolution test fixture.
// Demonstrates:
//   * bare specifier 'mylib' resolves to ./node_modules/mylib/
//     whose package.json main points to ./lib/index.js
//   * inside mylib, bare specifier 'another' resolves to
//     ./node_modules/another/ which has no package.json — falls
//     back to index.js under the resolver's dir-listing rules
//   * relative './helper' within mylib also resolves correctly

var mylib = require("mylib");
var got = mylib.hello("ppc");
console.log("got:", got);
if (got !== "Hi PPC! -- signed") {
    console.error("FAIL: got", JSON.stringify(got));
    process.exit(1);
}
console.log("ok: bare-specifier node_modules resolution works");
