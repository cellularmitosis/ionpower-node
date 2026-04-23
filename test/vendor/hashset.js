function HashSet(init) {
	this.map = Object.create(null);
	var map = this.map;

	if (toString.call(init) == '[object Array]') {
		init.forEach(function(v) { map[v] = 1; });
	} else if (arguments.length > 1) {
		this.map[init] = 1;
		[].forEach.call(arguments, function(v) { map[v] = 1; })
	} else if (arguments.length === 1) {
		map[init] = 1;
	}
}

HashSet.prototype.contains = function(val) {
	return !!this.map[val];
};

HashSet.prototype.add = function(val) {
	this.map[val] = 1;
};

HashSet.prototype.remove = function(val) {
	this.map[val] = undefined;
};

module.exports = HashSet;