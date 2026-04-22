// Exercises require() resolution: relative paths, .js inference, index.js.
const adder = require("./mod/adder");          // ./mod/adder/index.js
const greet = require("./mod/greet.js");       // explicit .js
const util  = require("./mod/util");           // ./mod/util.js via inference

console.log("adder(2, 3) =", adder.add(2, 3));
console.log("greet('world') =", greet.hello("world"));
console.log("util.shout('hi') =", util.shout("hi"));
