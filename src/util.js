const path = require('path');

function getConfig() {
    const config = require(path.join(process.cwd(), './config.conf'));
    return config;
}

module.exports = {
    getConfig,
};
