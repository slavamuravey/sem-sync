'use strict';

if (process.env.NODE_ENV === "production") {
  module.exports = require("./sem-sync.cjs.min.js");
} else {
  module.exports = require("./sem-sync.cjs.js");
}
