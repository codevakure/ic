const cookies = require('cookie');
const { isEnabled } = require('@ranger/api');
const { logger } = require('@ranger/data-schemas');
const { logoutUser } = require('~/server/services/AuthService');
const { getOpenIdConfig } = require('~/strategies');

const logoutController = async (req, res) => {
  const refreshToken = req.headers.cookie ? cookies.parse(req.headers.cookie).refreshToken : null;
  const openidIdToken = req.headers.cookie ? cookies.parse(req.headers.cookie).openid_id_token : null;
  
  try {
    const logout = await logoutUser(req, refreshToken);
    const { status, message } = logout;
    res.clearCookie('refreshToken');
    res.clearCookie('token_provider');
    res.clearCookie('openid_id_token'); // Clear the ID token cookie
    res.clearCookie('openid_access_token'); // Clear the access token cookie
    res.clearCookie('openid_user_id'); // Clear the user ID cookie
    
    const response = { message };
    if (
      req.user.openidId != null &&
      isEnabled(process.env.OPENID_USE_END_SESSION_ENDPOINT) &&
      process.env.OPENID_ISSUER
    ) {
      const openIdConfig = getOpenIdConfig();
      if (!openIdConfig) {
        logger.warn(
          '[logoutController] OpenID config not found. Please verify that the open id configuration and initialization are correct.',
        );
      } else {
        const endSessionEndpoint = openIdConfig
          ? openIdConfig.serverMetadata().end_session_endpoint
          : null;
        if (endSessionEndpoint) {
          // Build proper OIDC logout URL with required parameters
          const logoutUrl = new URL(endSessionEndpoint);
          
          // Add id_token_hint - try multiple sources
          let idToken = null;
          if (req.user.tokenset && req.user.tokenset.id_token) {
            // Available when OPENID_REUSE_TOKENS=true
            idToken = req.user.tokenset.id_token;
          } else if (openidIdToken) {
            // Available from cookie we stored during login
            idToken = openidIdToken;
          }
          
          if (idToken) {
            logoutUrl.searchParams.append('id_token_hint', idToken);
            logger.info('[logoutController] Added id_token_hint to logout URL');
          } else {
            logger.warn('[logoutController] No ID token available for logout - logout may fail');
          }
          
          // Add post_logout_redirect_uri if configured
          if (process.env.OPENID_POST_LOGOUT_REDIRECT_URI) {
            logoutUrl.searchParams.append('post_logout_redirect_uri', process.env.OPENID_POST_LOGOUT_REDIRECT_URI);
          }
          
          // Add state parameter for security (optional but recommended)
          const state = Buffer.from(JSON.stringify({ timestamp: Date.now(), userId: req.user._id })).toString('base64url');
          logoutUrl.searchParams.append('state', state);
          
          response.redirect = logoutUrl.toString();
        } else {
          logger.warn(
            '[logoutController] end_session_endpoint not found in OpenID issuer metadata. Please verify that the issuer is correct.',
          );
        }
      }
    }
    return res.status(status).send(response);
  } catch (err) {
    logger.error('[logoutController]', err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  logoutController,
};
