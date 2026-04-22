// iconv-lite: encode + decode round-trip for latin1, utf8, utf16-le.
// Lives under test/vendor/nm/ so it resolves safer-buffer / iconv-lite
// via the node_modules tree.
var path = require("path");
require(path.resolve("test/vendor/nm/iconv_entry.js"));
