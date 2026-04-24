'use strict';
// ionpower-node: is-absolute-url vendor is an ESM file (`export default`).
// Unwrap .default at require time.
const mod = require('is-absolute-url');
const isAbsoluteUrl = mod.default || mod;

module.exports = url => !isAbsoluteUrl(url);
