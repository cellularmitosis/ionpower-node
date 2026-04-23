'use strict';
const stripIndent = require('./strip-indent.js');
const indentString = require('./indent-string.js');

module.exports = (string, count = 0, options) => indentString(stripIndent(string), count, options);
