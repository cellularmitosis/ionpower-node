// cli-boxes: re-export of the bundled JSON data. The original package
// ships boxes.json as its main entry; for the ionpower-node vendor
// layout we wrap it so `require('cli-boxes')` gets the box table
// directly.
'use strict';
module.exports = require('./cli-boxes.json');
