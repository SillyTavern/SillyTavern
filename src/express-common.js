const express = require('express');

// Instantiate parser middleware here with application-level size limits
const jsonParser = express.json({ limit: '200mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '200mb' });

module.exports = { jsonParser, urlencodedParser };
