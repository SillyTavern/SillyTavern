const express = require('express');
const ipaddr = require('ipaddr.js');

// Instantiate parser middleware here with application-level size limits
const jsonParser = express.json({ limit: '200mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '200mb' });

/**
 * Gets the IP address of the client from the request object.
 * @param {import('express'.Request)} req Request object
 * @returns {string} IP address of the client
 */
function getIpFromRequest(req) {
    let clientIp = req.connection.remoteAddress;
    let ip = ipaddr.parse(clientIp);
    // Check if the IP address is IPv4-mapped IPv6 address
    if (ip.kind() === 'ipv6' && ip instanceof ipaddr.IPv6 && ip.isIPv4MappedAddress()) {
        const ipv4 = ip.toIPv4Address().toString();
        clientIp = ipv4;
    } else {
        clientIp = ip;
        clientIp = clientIp.toString();
    }
    return clientIp;
}


module.exports = { jsonParser, urlencodedParser, getIpFromRequest };
