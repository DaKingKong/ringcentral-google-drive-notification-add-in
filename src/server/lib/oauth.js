const constants = require('./constants');
const ClientOAuth2 = require('client-oauth2');

// oauthApp strategy is default to 'code' which use credentials to get accessCode, then exchange for accessToken and refreshToken.
// To change to other strategies, please refer to: https://github.com/mulesoft-labs/js-client-oauth2
const oauthApp = new ClientOAuth2({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    accessTokenUri: process.env.ACCESS_TOKEN_URI,
    authorizationUri: process.env.AUTHORIZATION_URI,
    redirectUri: `${process.env.APP_SERVER}${constants.route.forThirdParty.AUTH_CALLBACK}`,
    scopes: process.env.SCOPES.split(process.env.SCOPES_SEPARATOR)
});

function getOAuthApp() {
    return oauthApp;
}

async function checkAndRefreshAccessToken(user) {
    const dateNow = new Date();
    if (user && user.refreshToken && (user.tokenExpiredAt < dateNow || !user.accessToken)) {
        console.log(`refreshing token...revoking ${user.accessToken}`);
        const token = oauthApp.createToken(user.accessToken, user.refreshToken);
        const { accessToken, refreshToken, expires } = await token.refresh();
        console.log(`refreshing token...updating new token: ${user.accessToken}`);
        user.accessToken = accessToken;
        user.refreshToken = refreshToken;
        user.tokenExpiredAt = expires;
        await user.save();
    }
}

exports.getOAuthApp = getOAuthApp;
exports.checkAndRefreshAccessToken = checkAndRefreshAccessToken;