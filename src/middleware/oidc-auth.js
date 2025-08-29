import * as client from 'openid-client';
import { getConfigValue, color } from '../util.js';

/**
 * @typedef {import('openid-client').Configuration} OidcConfiguration
 * @typedef {import('openid-client').TokenEndpointResponse & import('openid-client').TokenEndpointResponseHelpers} TokenEndpointResponseWithHelpers
 */

/** @type {OidcConfiguration|null} */
let oidcConfig = null;

/**
 * Gets the OIDC configuration from config.yaml
 * @returns {object} OIDC configuration object
 */
export function getOidcConfig() {
    return {
        enabled: getConfigValue('oidc.enabled', false, 'boolean'),
        debug: getConfigValue('oidc.debug', false, 'boolean'),
        provider: {
            issuer: getConfigValue('oidc.provider.issuer', ''),
            clientId: getConfigValue('oidc.provider.clientId', ''),
            clientSecret: getConfigValue('oidc.provider.clientSecret', ''),
            redirectUri: getConfigValue('oidc.provider.redirectUri', ''),
            scope: getConfigValue('oidc.provider.scope', 'openid profile email'),
            responseType: getConfigValue('oidc.provider.responseType', 'code'),
            responseMode: getConfigValue('oidc.provider.responseMode', 'query'),
        },
        claims: {
            userId: getConfigValue('oidc.claims.userId', 'sub'),
            displayName: getConfigValue('oidc.claims.displayName', 'preferred_username'),
            email: getConfigValue('oidc.claims.email', 'email'),
            adminRole: getConfigValue('oidc.claims.adminRole', 'urn:zitadel:iam:org:project:roles'),
        },
        ui: {
            loginButtonText: getConfigValue('oidc.ui.loginButtonText', 'Login with SSO'),
            disableBuiltinAuth: getConfigValue('oidc.ui.disableBuiltinAuth', true, 'boolean'),
        },
    };
}

/**
 * Checks if OIDC is properly configured
 * @returns {boolean} True if OIDC is configured
 */
export function isOidcConfigured() {
    const config = getOidcConfig();
    return config.enabled &&
           config.provider.issuer &&
           config.provider.clientId &&
           config.provider.clientSecret &&
           config.provider.redirectUri;
}

/**
 * Initializes the OIDC client by discovering the provider
 * @returns {Promise<OidcConfiguration|null>} The initialized OIDC configuration or null
 */
export async function initOidcClient() {
    try {
        const config = getOidcConfig();

        if (!config.enabled) {
            console.log('OIDC is disabled in configuration');
            return null;
        }

        if (!isOidcConfigured()) {
            console.error(color.red('OIDC configuration incomplete. Missing issuer, clientId, clientSecret, or redirectUri.'));
            return null;
        }

        if (config.debug) {
            console.log('Discovering OIDC provider:', config.provider.issuer);
        }

        // Use discovery to get provider configuration
        oidcConfig = await client.discovery(
            new URL(config.provider.issuer),
            config.provider.clientId,
            config.provider.clientSecret,
            client.ClientSecretPost(config.provider.clientSecret),
        );

        console.log(color.green('OIDC client configured successfully'));
        return oidcConfig;

    } catch (error) {
        console.error(color.red('Failed to initialize OIDC client:'), error.message);
        if (getOidcConfig().debug) {
            console.error(error);
        }
        return null;
    }
}

/**
 * Gets the initialized OIDC configuration
 * @returns {OidcConfiguration|null} The OIDC configuration or null if not initialized
 */
export function getOidcClient() {
    return oidcConfig;
}

/**
 * Generates an authorization URL for OIDC login
 * @param {import('express').Request} request Express request object
 * @returns {string} Authorization URL
 */
export function generateAuthorizationUrl(request) {
    if (!oidcConfig) {
        throw new Error('OIDC client not initialized');
    }

    const config = getOidcConfig();
    const state = client.randomState();
    const nonce = client.randomNonce();

    // Store state and nonce in session for validation
    if (!request.session) {
        throw new Error('Session not available for OIDC state storage');
    }

    request.session.oidc_state = state;
    request.session.oidc_nonce = nonce;

    const authUrl = client.buildAuthorizationUrl(oidcConfig, {
        redirect_uri: config.provider.redirectUri,
        scope: config.provider.scope,
        state: state,
        nonce: nonce,
        response_type: config.provider.responseType,
    });

    return authUrl.toString();
}

/**
 * Handles the OIDC callback and exchanges the authorization code for tokens
 * @param {import('express').Request} request Express request object
 * @returns {Promise<TokenEndpointResponseWithHelpers>} The token set from the OIDC provider
 */
export async function handleOidcCallback(request) {
    if (!oidcConfig) {
        throw new Error('OIDC client not initialized');
    }

    const config = getOidcConfig();

    if (config.debug) {
        console.log('OIDC callback received:', request.query);
    }

    // Validate state parameter for CSRF protection
    if (!request.session) {
        throw new Error('Session not available for OIDC state validation');
    }

    if (request.query.state !== request.session.oidc_state) {
        throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Create URL from request for openid-client
    const callbackUrl = new URL(request.originalUrl, `${request.protocol}://${request.get('host')}`);

    // Exchange authorization code for tokens
    const tokenSet = await client.authorizationCodeGrant(
        oidcConfig,
        callbackUrl,
        {
            expectedState: request.session.oidc_state,
            expectedNonce: request.session.oidc_nonce,
        },
    );

    // Clean up session data
    if (request.session) {
        delete request.session.oidc_state;
        delete request.session.oidc_nonce;
    }

    if (config.debug) {
        console.log('OIDC tokens received:', {
            access_token: tokenSet.access_token ? '[PRESENT]' : '[MISSING]',
            id_token: tokenSet.id_token ? '[PRESENT]' : '[MISSING]',
            refresh_token: tokenSet.refresh_token ? '[PRESENT]' : '[MISSING]',
        });
    }

    return tokenSet;
}

/**
 * Extracts user claims from the token set
 * @param {TokenEndpointResponseWithHelpers} tokenSet The token set from OIDC provider
 * @returns {object} User claims
 */
export function extractUserClaims(tokenSet) {
    if (!tokenSet || !tokenSet.id_token) {
        throw new Error('No ID token in token set');
    }

    // Parse the ID token to get claims using the helper method
    // The claims() method can return undefined if no ID token was returned
    const claims = tokenSet.claims();

    if (!claims) {
        throw new Error('No claims found in ID token');
    }

    if (getOidcConfig().debug) {
        console.log('Extracted claims:', JSON.stringify(claims, null, 2));
    }

    return claims;
}

/**
 * Generates a logout URL for the OIDC provider
 * @param {string} postLogoutRedirectUri The URL to redirect to after logout
 * @returns {string} Logout URL
 */
export function generateLogoutUrl(postLogoutRedirectUri) {
    if (!oidcConfig) {
        throw new Error('OIDC client not initialized');
    }

    const logoutUrl = client.buildEndSessionUrl(oidcConfig, {
        post_logout_redirect_uri: postLogoutRedirectUri,
    });

    return logoutUrl.toString();
}

/**
 * OIDC authentication middleware for protecting routes
 * @param {import('express').Request} request Express request object
 * @param {import('express').Response} response Express response object
 * @param {import('express').NextFunction} next Express next function
 */
export function oidcAuthMiddleware(request, response, next) {
    // Skip OIDC middleware if not configured or user already authenticated
    if (!isOidcConfigured() || request.user) {
        return next();
    }

    // Skip authentication for API routes, static assets, and auth routes
    const skipPaths = [
        '/api/',
        '/auth/',
        '/public/',
        '/scripts/',
        '/css/',
        '/img/',
        '/locales/',
        '/characters/',
        '/backgrounds/',
        '/assets/',
        '/user/',
        '/thumbnails/',
        '/csrf-token',
        '/login',
    ];

    const shouldSkip = skipPaths.some(path => request.path.startsWith(path));
    if (shouldSkip) {
        return next();
    }

    // Only protect main application routes like root path
    // Check for OIDC tokens in session
    if (request.session && request.session.oidc_tokens) {
        // User has OIDC tokens, they're authenticated
        return next();
    }

    // For GET requests that aren't skipped, redirect to OIDC login
    if (request.method === 'GET') {
        const query = request.url.split('?')[1];
        const redirectUrl = query ? `/auth/oidc/login?${query}` : '/auth/oidc/login';
        return response.redirect(redirectUrl);
    }

    // For non-GET requests (like POST API calls), continue without authentication
    // The requireLoginMiddleware will handle these appropriately
    return next();
}
