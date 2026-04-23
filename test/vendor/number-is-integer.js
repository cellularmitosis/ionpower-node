'use strict';
var numberIsFinite = require('./is-finite.js');

module.exports = Number.isInteger || function (x) {
	return numberIsFinite(x) && Math.floor(x) === x;
};
