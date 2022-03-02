const { getOAuthApp } = require('../lib/oauth');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { GoogleUser } = require('../models/googleUserModel');
const { google } = require('googleapis')
const Op = require('sequelize').Op;
const rcAPI = require('../lib/rcAPI');
const subscriptionHandler = require('./subscriptionHandler');

const { Template } = require('adaptivecards-templating');
const authCardTemplate = require('../adaptiveCardPayloads/authCard.json');
const unAuthCardTemplate = require('../adaptiveCardPayloads/unAuthCard.json');

async function getInGroupRcUserGoogleAccountInfo(groupId, accessToken, botId) {
    const rcGroupInfo = await rcAPI.getGroupInfo(groupId, accessToken);

    const membersInGroup = rcGroupInfo.members;
    const existingUsers = await GoogleUser.findAll({
        where: {
            rcUserId: {
                [Op.or]: membersInGroup
            }
        }
    });

    const rcUserIdsWithGoogleAccount = existingUsers.map(u => u.rcUserId);
    const rcUserIdsWithoutGoogleAccount = membersInGroup.filter(u => !rcUserIdsWithGoogleAccount.includes(u) && u != botId);

    const inGroupUserInfo = {
        rcUserIdsWithGoogleAccount,
        rcUserIdsWithoutGoogleAccount
    }

    return inGroupUserInfo;
}

function getAuthCard(authLink) {
    const template = new Template(authCardTemplate);
    const cardData = {
        link: authLink
    }
    const card = template.expand({
        $root: cardData
    });
    return card;
}

function getUnAuthCard(googleUserEmail, rcUserId, botId){
    const template = new Template(unAuthCardTemplate);
    const cardData = {
        googleUserEmail,
        rcUserId,
        botId
    }
    const card = template.expand({
        $root: cardData
    });
    return card;
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

            await bot.sendMessage(user.rcDMGroupId, { text: `Authorized Google Account ${googleUserInfoResponse.email} for ${rcUserInfo.firstName} ${rcUserInfo.lastName}.` });
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
    res.send('<!doctype><html><body><script>close()</script></body></html>')
};

async function checkUserFileAccess(googleUser, fileId) {
    try {
        const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });
        await drive.files.get({ fileId, fields: 'id' });
        return true;
    }
    catch (e) {
        // google user cannot find the file => no access
        if (e.response.status === 404) {
            return false;
        }
    }
}

exports.getInGroupRcUserGoogleAccountInfo = getInGroupRcUserGoogleAccountInfo;
exports.getAuthCard = getAuthCard;
exports.getUnAuthCard = getUnAuthCard;
exports.oauthCallback = oauthCallback;
exports.checkUserFileAccess = checkUserFileAccess;