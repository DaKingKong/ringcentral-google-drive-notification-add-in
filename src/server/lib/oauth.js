const ClientOAuth2 = require('client-oauth2');
const axios = require('axios');

// oauthApp strategy is default to 'code' which use credentials to get accessCode, then exchange for accessToken and refreshToken.
// To change to other strategies, please refer to: https://github.com/mulesoft-labs/js-client-oauth2
const oauthApp = new ClientOAuth2({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    accessTokenUri: process.env.ACCESS_TOKEN_URI,
    authorizationUri: process.env.AUTHORIZATION_URI,
    redirectUri: `${process.env.RINGCENTRAL_CHATBOT_SERVER}/oauth-callback`,
    scopes: process.env.SCOPES.split(process.env.SCOPES_SEPARATOR)
});

function getOAuthApp() {
    return oauthApp;
}

async function checkAndRefreshAccessToken(googleUser) {
    const dateNow = new Date();
    if (googleUser && googleUser.refreshToken && (googleUser.tokenExpiredAt < dateNow || !googleUser.accessToken)) {
        console.log(`refreshing token...revoking ${googleUser.accessToken}`);
        const token = oauthApp.createToken(googleUser.accessToken, googleUser.refreshToken);
        const { accessToken, refreshToken, expires } = await token.refresh();
        console.log(`refreshing token...`);
        await googleUser.update(
            {
                accessToken,
                refreshToken,
                tokenExpiredAt: expires,
            }
        );
    }
}

async function revokeToken(googleUser){
    await checkAndRefreshAccessToken(googleUser);
    await axios.post(
        `https://oauth2.googleapis.com/revoke?token=${googleUser.refreshToken}`
    );
}

exports.getOAuthApp = getOAuthApp;
exports.checkAndRefreshAccessToken = checkAndRefreshAccessToken;
exports.revokeToken = revokeToken;