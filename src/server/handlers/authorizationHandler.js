const { User } = require('../models/userModel');
const { google } = require('googleapis')


async function onAuthorize(accessToken, refreshToken, expires) {
    const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${accessToken}` } });
    const userResponse = await drive.about.get({ fields: 'user' });
    const userData = userResponse.data.user;
    // Step.1: Get user info from 3rd party API call
    const userInfoResponse = { id: userData.permissionId, email: userData.emailAddress, name: userData.displayName }   // [REPLACE] this line with actual call
    const userId = userInfoResponse.id; // [REPLACE] this line with user id from actual response

    // Find if it's existing user in our database
    let user = await User.findByPk(userId);
    // Step.2: If user doesn't exist, we want to create a new one
    if (!user) {
        user = await User.create({
            id: userId,
            accessToken: accessToken,
            refreshToken: refreshToken,
            tokenExpiredAt: expires,
            email: userInfoResponse.email, // [REPLACE] this with actual user email in response, [DELETE] this line if user info doesn't contain email
            name: userInfoResponse.name, // [REPLACE] this with actual user name in response, [DELETE] this line if user info doesn't contain name
            subscriptions: []
        });
    }
    // If user exists but logged out, we want to fill in token info
    else if (!user.accessToken) {
        user.accessToken = accessToken;
        user.tokenExpiredAt = expires;
        await user.save();
    }

    return userId;
}

async function onUnauthorize(userId) {
    const user = await User.findByPk(userId);
    if (user) {
        // Clear database info
        user.rcUserId = '';
        user.accessToken = '';
        await user.save();
    }
}

exports.onAuthorize = onAuthorize;
exports.onUnauthorize = onUnauthorize;