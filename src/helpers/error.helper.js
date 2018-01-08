var errors = require('../errors/errors.json');

const uuid = '04';

var error = {};

error.construct = function(identifier, occurence){
  var error = {};
  error.code = errors[identifier].code;
  error.message = errors[identifier].message;
  return error;
}

module.exports = error;
