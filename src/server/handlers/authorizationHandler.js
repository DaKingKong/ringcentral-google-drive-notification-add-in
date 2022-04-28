const { getOAuthApp, checkAndRefreshAccessToken } = require('../lib/oauth');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { GoogleUser } = require('../models/googleUserModel');
const { google } = require('googleapis')
const Op = require('sequelize').Op;
const rcAPI = require('../lib/rcAPI');
const subscriptionHandler = require('./subscriptionHandler');

async function getInGroupRcUserGoogleAccountInfo(groupId, accessToken) {
    const rcGroupInfo = await rcAPI.getGroupInfo(groupId, accessToken);

    const membersInGroup = rcGroupInfo.members;
    const nonBotNonGuestMembersInGroup = [];
    const rcUserInfo = [];

    const bulkRes = await rcAPI.getBulkUserInfo(membersInGroup, accessToken);

    for (const memberInfo of bulkRes) {
        try {
            // Case: a bot would end with '.bot.glip.net'
            if (memberInfo.email && memberInfo.email.endsWith('.bot.glip.net')) {
                continue;
            }

            nonBotNonGuestMembersInGroup.push(memberInfo.id);
            rcUserInfo.push(
                {
                    id: memberInfo.id,
                    name: `${memberInfo.firstName} ${memberInfo.lastName}`
                });
        }
        catch (e) {
            if (e.message === 'Request failed with status code 404') {
                continue;
            }
        }
    }

    const existingUsers = await GoogleUser.findAll({
        where: {
            rcUserId: {
                [Op.or]: nonBotNonGuestMembersInGroup
            }
        }
    });

    const rcUserIdsWithGoogleAccount = existingUsers.map(u => u.rcUserId);
    const rcUserIdsAndNamesWithGoogleAccount = rcUserInfo.filter(r => rcUserIdsWithGoogleAccount.includes(r.id));
    const rcUserIdsWithoutGoogleAccount = nonBotNonGuestMembersInGroup.filter(u => !rcUserIdsWithGoogleAccount.includes(u));

    const inGroupUserInfo = {
        rcUserIdsWithGoogleAccount,
        rcUserIdsAndNamesWithGoogleAccount,
        rcUserIdsWithoutGoogleAccount
    }

    return inGroupUserInfo;
}

async function oauthCallback(req, res) {
    const queryParams = new URLSearchParams(req.query.state)
    const botId = queryParams.get('botId');
    const rcUserId = queryParams.get('rcUserId');
    const oauthApp = getOAuthApp();
    const bot = await Bot.findByPk(botId);
    if (!bot) {
        console.error(`Bot not found with botId: ${botId}`);
        res.status(404);
        res.send('Bot not found');
        return;
    }

    const { accessToken, refreshToken, expires } = await oauthApp.code.getToken(req.url);
    if (!accessToken) {
        res.status(403);
        res.send('Params error');
        return;
    }

    console.log(`Receiving accessToken: ${accessToken} and refreshToken: ${refreshToken}`);
    try {
        const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${accessToken}` } });
        const userResponse = await drive.about.get({ fields: 'user' });
        const userData = userResponse.data.user;
        // Step.1: Get user info from 3rd party API call
        const googleUserInfoResponse = { id: userData.permissionId, email: userData.emailAddress, name: userData.displayName }   // [REPLACE] this line with actual call
        const googleUserId = googleUserInfoResponse.id; // [REPLACE] this line with user id from actual response

        // Create/Find DM conversation to the RC user
        const createGroupResponse = await rcAPI.createConversation([rcUserId], bot.token.access_token);

        // Find if it's existing user in our database
        let user = await GoogleUser.findByPk(googleUserId);
        // Step.2: If user doesn't exist, we want to create a new one
        if (!user) {
            user = await GoogleUser.create({
                id: googleUserId,
                botId,
                rcUserId: rcUserId,
                accessToken: accessToken,
                refreshToken: refreshToken,
                tokenExpiredAt: expires,
                email: googleUserInfoResponse.email, // [REPLACE] this with actual user email in response, [DELETE] this line if user info doesn't contain email
                name: googleUserInfoResponse.name, // [REPLACE] this with actual user name in response, [DELETE] this line if user info doesn't contain name,
                rcDMGroupId: createGroupResponse.id,
                isReceiveNewFile: true
            });

            const rcUserInfo = await rcAPI.getUserInfo(rcUserId, bot.token.access_token);

            // create a global subscription for this google user
            await subscriptionHandler.createGlobalSubscription(user);

            await bot.sendMessage(user.rcDMGroupId, { text: `Authorized Google Account ${googleUserInfoResponse.email} for ${rcUserInfo.firstName} ${rcUserInfo.lastName}. Now that you've authorized the Google Drive Bot, you will start receiving notifications here when new files are shared with you.` });
        }
        else {
            await bot.sendMessage(user.rcDMGroupId, { text: `Google Account ${googleUserInfoResponse.email} already exists.` });
        }

    } catch (e) {
        console.error(e);
        res.status(500);
        res.send('Internal error.');
    }
    res.status(200);
    res.send('<!doctype><html><body>Successfully authorized. Please close this page.</body></html>')
};

async function checkUserFileAccess(googleUser, fileId) {
    try {
        await checkAndRefreshAccessToken(googleUser);
        const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });
        await drive.files.get({ fileId, fields: 'id', supportsAllDrives: true });
        return true;
    }
    catch (e) {
        // google user cannot find the file => no access
        if (e.response.status === 404) {
            return false;
        }
    }
}

async function grantFileAccessToUser(googleFileOwnerUser, fileId, grantUserInfo, permissionRole) {
    try {
        await checkAndRefreshAccessToken(googleFileOwnerUser);
        const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleFileOwnerUser.accessToken}` } });
        await drive.permissions.create({
            fileId,
            sendNotificationEmail: false,
            requestBody: {
                role: permissionRole,
                emailAddress: grantUserInfo.email,
                type: 'user'
            }
        });

        return true;
    }
    catch (e) {
        return false;
    }
}

exports.getInGroupRcUserGoogleAccountInfo = getInGroupRcUserGoogleAccountInfo;
exports.oauthCallback = oauthCallback;
exports.checkUserFileAccess = checkUserFileAccess;
exports.grantFileAccessToUser = grantFileAccessToUser;