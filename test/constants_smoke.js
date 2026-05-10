// require('constants') seed (Node 10 parity, pass 1).
//
// graceful-fs and friends do `var c = require('constants')` then
// feature-detect on hasOwnProperty('O_SYMLINK') etc. Real Node ships
// O_*, S_IF*, errno integers here. Pass 1 ships fs flags + common
// errno values; signals are punted to a later pass.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var constants = require("constants");
assert(typeof constants === "object" && constants !== null,
       "constants is object");

// Open flags.
assert(constants.O_RDONLY === 0,    "O_RDONLY === 0");
assert(constants.O_WRONLY === 1,    "O_WRONLY === 1");
assert(constants.O_RDWR   === 2,    "O_RDWR   === 2");
assert(typeof constants.O_CREAT  === "number", "O_CREAT  is number");
assert(typeof constants.O_APPEND === "number", "O_APPEND is number");
assert(typeof constants.O_TRUNC  === "number", "O_TRUNC  is number");
assert(typeof constants.O_EXCL   === "number", "O_EXCL   is number");
// graceful-fs feature-detection probe.
assert(constants.hasOwnProperty("O_SYMLINK"),
       "constants.hasOwnProperty('O_SYMLINK') (graceful-fs probe)");
console.log("ok: O_* flags present");

// Stat mode bits.
assert(constants.S_IFMT  === 0xF000, "S_IFMT");
assert(constants.S_IFREG === 0x8000, "S_IFREG");
assert(constants.S_IFDIR === 0x4000, "S_IFDIR");
assert(constants.S_IFLNK === 0xA000, "S_IFLNK");
assert(constants.S_IFSOCK === 0xC000, "S_IFSOCK");
console.log("ok: S_IF* mode bits present");

// fs.access() modes.
assert(constants.F_OK === 0, "F_OK");
assert(constants.R_OK === 4, "R_OK");
assert(constants.W_OK === 2, "W_OK");
assert(constants.X_OK === 1, "X_OK");
console.log("ok: F/R/W/X_OK present");

// Common errno values (darwin numbers).
assert(constants.EPERM   === 1,  "EPERM");
assert(constants.ENOENT  === 2,  "ENOENT");
assert(constants.EINTR   === 4,  "EINTR");
assert(constants.EBADF   === 9,  "EBADF");
assert(constants.EACCES  === 13, "EACCES");
assert(constants.EEXIST  === 17, "EEXIST");
assert(constants.EINVAL  === 22, "EINVAL");
assert(constants.ENOSPC  === 28, "ENOSPC");
assert(constants.ENOTEMPTY === 66, "ENOTEMPTY");
console.log("ok: common errno values present");

// require('constants') is identity across calls.
var c2 = require("constants");
assert(c2 === constants, "require('constants') returns the cached object");
console.log("ok: require('constants') is cached");

// module.builtinModules includes 'constants'.
var Module = require("module");
assert(Module.builtinModules.indexOf("constants") >= 0,
       "module.builtinModules includes 'constants'");
console.log("ok: 'constants' in builtinModules");

console.log("\nconstants smoke: all assertions passed");
