// jsonwebtoken: full sign+verify round-trip for HS256. Exercises
// our Buffer shim's Buffer.prototype + Uint8Array.prototype method set,
// crypto.createHmac('sha256'), crypto.KeyObject, and the multi-file
// node_modules resolution.

var path = require("path");
require(path.resolve("test/vendor/nm/jsonwebtoken_entry.js"));
