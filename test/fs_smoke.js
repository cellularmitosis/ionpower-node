const fs   = require("fs");
const path = require("path");

const tmp = "/tmp/ionpower-node-fs-smoke.txt";
const body = "the quick brown fox\njumps over the lazy dog\n";

fs.writeFileSync(tmp, body);
console.log("wrote", tmp);

const back = fs.readFileSync(tmp, "utf8");
console.log("readback length:", back.length, "match:", back === body);

const st = fs.statSync(tmp);
console.log("size:", st.size, "isFile:", st.isFile, "isDir:", st.isDirectory);

const entries = fs.readdirSync("/tmp");
console.log("/tmp has", entries.length, "entries (sample:",
            entries.slice(0, 3), ")");

console.log("path.join =", path.join("a", "b", "c.txt"));
console.log("path.dirname(tmp) =", path.dirname(tmp));
console.log("path.basename(tmp) =", path.basename(tmp));
console.log("path.extname(tmp) =", path.extname(tmp));
console.log("path.isAbsolute(tmp) =", path.isAbsolute(tmp));

fs.unlinkSync(tmp);
console.log("unlinked. exists now? ", fs.existsSync(tmp));
