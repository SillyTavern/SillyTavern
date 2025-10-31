import ipaddr from 'ipaddr.js';

const noopMiddleware = (_req, _res, next) => next();
/** @deprecated Do not use. A global middleware is provided at the application level. */
export const jsonParser = noopMiddleware;
/** @deprecated Do not use. A global middleware is provided at the application level. */
export const urlencodedParser = noopMiddleware;

/**
 * Gets the IP address of the client from the request object.
 * @param {import('express').Request} req Request object
 * @returns {string} IP address of the client
 */
export function getIpFromRequest(req) {
    let clientIp = req.socket.remoteAddress;
    if (!clientIp) {
        return 'unknown';
    }
    let ip = ipaddr.parse(clientIp);
    // Check if the IP address is IPv4-mapped IPv6 address
    if (ip.kind() === 'ipv6' && ip instanceof ipaddr.IPv6 && ip.isIPv4MappedAddress()) {
        const ipv4 = ip.toIPv4Address().toString();
        clientIp = ipv4;
    } else {
        clientIp = ip.toString();
    }
    return clientIp;
}

/**
 * Gets the IP address of the client when behind reverse proxy using x-real-ip header, falls back to socket remote address.
 * This function should be used when the application is running behind a reverse proxy (e.g., Nginx, traefik, Caddy...).
 * @param {import('express').Request} req Request object
 * @returns {string} IP address of the client
 */
export function getRealIpFromHeader(req) {
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'].toString();
    }

    return getIpFromRequest(req);
}
