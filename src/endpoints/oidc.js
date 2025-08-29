import express from 'express';
import {
    getOidcClient,
    handleOidcCallback,
    extractUserClaims,
    generateLogoutUrl,
    getOidcConfig,
    generateAuthorizationUrl,
} from '../middleware/oidc-auth.js';
import { getOrCreateOidcUser } from '../users.js';
import { color } from '../util.js';

const router = express.Router();

/**
 * OIDC login endpoint - redirects to OIDC provider
 */
router.get('/login', async (request, response) => {
    try {
        const oidcClient = getOidcClient();
        if (!oidcClient) {
            console.error('OIDC client not initialized');
            return response.status(500).send('OIDC not properly configured');
        }

        // Generate authorization URL and redirect
        const authUrl = generateAuthorizationUrl(request);

        if (getOidcConfig().debug) {
            console.log('Redirecting to OIDC provider:', authUrl);
        }

        return response.redirect(authUrl);

    } catch (error) {
        console.error(color.red('OIDC login error:'), error.message);
        return response.status(500).send('Authentication failed');
    }
});

/**
 * OIDC callback endpoint - handles the response from OIDC provider
 */
router.get('/callback', async (request, response) => {
    try {
        const oidcClient = getOidcClient();
        if (!oidcClient) {
            console.error('OIDC client not initialized');
            return response.status(500).send('OIDC not properly configured');
        }

        const config = getOidcConfig();

        if (config.debug) {
            console.log('OIDC callback received:', request.query);
        }

        // Handle authorization code exchange
        const tokenSet = await handleOidcCallback(request);

        // Extract user claims from tokens
        const claims = extractUserClaims(tokenSet);

        if (config.debug) {
            console.log('User claims extracted:', JSON.stringify(claims, null, 2));
        }

        // Create or update user from OIDC claims
        const user = await getOrCreateOidcUser(claims);

        if (!user) {
            throw new Error('Failed to create or update user from OIDC claims');
        }

        // Create SillyTavern session
        if (!request.session) {
            throw new Error('Session not available');
        }

        request.session.handle = user.handle;
        request.session.oidc_tokens = {
            access_token: tokenSet.access_token,
            id_token: tokenSet.id_token,
            refresh_token: tokenSet.refresh_token,
            expires_at: tokenSet.expires_at,
        };

        console.log(color.green(`OIDC user authenticated: ${user.name} (${user.handle})`));

        // Redirect to the main application
        return response.redirect('/');

    } catch (error) {
        console.error(color.red('OIDC callback error:'), error.message);

        if (getOidcConfig().debug) {
            console.error(error);
        }

        // Clear any partial session data
        if (request.session) {
            request.session.destroy((err) => {
                if (err) {
                    console.error('Failed to destroy session:', err);
                }
            });
        }

        return response.status(500).send('Authentication failed: ' + error.message);
    }
});

/**
 * OIDC logout endpoint - clears session and redirects to OIDC provider logout
 */
router.post('/logout', async (request, response) => {
    try {
        const oidcClient = getOidcClient();
        const config = getOidcConfig();
        let logoutUrl = '/';

        // Generate OIDC logout URL if client is available
        if (oidcClient) {
            try {
                const postLogoutRedirectUri = `${request.protocol}://${request.get('host')}/`;
                logoutUrl = generateLogoutUrl(postLogoutRedirectUri);

                if (config.debug) {
                    console.log('Generated OIDC logout URL:', logoutUrl);
                }
            } catch (error) {
                console.error('Failed to generate OIDC logout URL:', error.message);
                // Continue with local logout
            }
        }

        // Clear the session
        if (request.session) {
            request.session.destroy((error) => {
                if (error) {
                    console.error('Failed to destroy session during logout:', error);
                }
            });
        }

        console.log('User logged out via OIDC');

        // Redirect to OIDC provider logout or home page
        return response.redirect(logoutUrl);

    } catch (error) {
        console.error(color.red('OIDC logout error:'), error.message);

        // Ensure session is cleared even if logout fails
        if (request.session) {
            request.session.destroy((err) => {
                if (err) {
                    console.error('Failed to destroy session:', err);
                }
            });
        }

        return response.redirect('/');
    }
});

/**
 * OIDC status endpoint - returns current OIDC configuration status
 */
router.get('/status', (request, response) => {
    try {
        const config = getOidcConfig();
        const oidcClient = getOidcClient();

        const status = {
            enabled: config.enabled,
            configured: !!oidcClient,
            provider: config.provider.issuer ? {
                issuer: config.provider.issuer,
                clientId: config.provider.clientId,
                scope: config.provider.scope,
            } : null,
            user: request.user ? {
                handle: request.user.profile.handle,
                name: request.user.profile.name,
                admin: request.user.profile.admin,
                oidc: request.user.profile.oidc,
            } : null,
        };

        return response.json(status);

    } catch (error) {
        console.error('OIDC status error:', error.message);
        return response.status(500).json({ error: 'Failed to get OIDC status' });
    }
});

/**
 * OIDC configuration info endpoint - returns UI configuration for login page
 */
router.get('/config', (request, response) => {
    try {
        const config = getOidcConfig();

        const uiConfig = {
            enabled: config.enabled,
            loginButtonText: config.ui.loginButtonText,
            disableBuiltinAuth: config.ui.disableBuiltinAuth,
        };

        return response.json(uiConfig);

    } catch (error) {
        console.error('OIDC config error:', error.message);
        return response.status(500).json({ error: 'Failed to get OIDC configuration' });
    }
});

/**
 * Error handler for OIDC routes
 */
router.use((error, request, response, next) => {
    console.error(color.red('OIDC router error:'), error.message);

    if (getOidcConfig().debug) {
        console.error(error);
    }

    response.status(500).json({
        error: 'OIDC operation failed',
        message: error.message,
    });
});

export default router;
