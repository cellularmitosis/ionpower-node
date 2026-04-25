/*
 * PARSE BOOL
 * Converts a string representation of a bool into a Boolean value.
 */

module.exports = function (input) {

  // Ensure we can use one switch for booleans and strings.
  input = (typeof input === 'string' ? input.toLowerCase() : input);

  // Do we have a valid representation of a bool?
  switch (input) {

    case true:
    case 'true':  return true;

    case false:
    case 'false': return false;

    case null:
    case 'null':  return null;

  }

  // Last ditch attempt.
  return Boolean(input);

};
