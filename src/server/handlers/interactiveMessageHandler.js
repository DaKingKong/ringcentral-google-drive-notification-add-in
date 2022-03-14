const crypto = require('crypto');
const { google } = require('googleapis')
const { GoogleUser } = require('../models/googleUserModel');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { revokeToken, checkAndRefreshAccessToken } = require('../lib/oauth');
const cardBuilder = require('../lib/cardBuilder');
const rcAPI = require('../lib/rcAPI');
const { Template } = require('adaptivecards-templating');
const subscribeCardTemplateJson = require('../adaptiveCardPayloads/subscribeCard.json');

const subscriptionHandler = require('./subscriptionHandler');
const authorizationHandler = require('./authorizationHandler');

async function interactiveMessages(req, res) {
    try {
        // Shared secret can be found on RingCentral developer portal, under your app Settings
        const SHARED_SECRET = process.env.IM_SHARED_SECRET;
        if (SHARED_SECRET) {
            const signature = req.get('X-Glip-Signature', 'sha1=');
            const encryptedBody =
                crypto.createHmac('sha1', SHARED_SECRET).update(JSON.stringify(req.body)).digest('hex');
            if (encryptedBody !== signature) {
                res.status(401).send();
                return;
            }
        }
        const body = req.body;
        console.log(`Incoming interactive message: ${JSON.stringify(body, null, 2)}`);
        if (!body.data || !body.user || !body.data.botId) {
            res.status(400);
            res.send('Params error');
            return;
        }
        const { botId } = body.data;
        const bot = await Bot.findByPk(botId);
        if (!bot) {
            console.error(`Bot not found with id: ${botId}`);
            res.status(400);
            res.send('Bot not found');
            return;
        }
        const groupId = body.conversation.id;
        const rcUserId = body.user.extId;

        const googleUser = await GoogleUser.findOne({
            where: {
                rcUserId
            }
        });

        // Create/Find DM conversation to the RC user
        const createGroupResponse = await rcAPI.createConversation([rcUserId], bot.token.access_token);

        if (!googleUser) {
            await bot.sendMessage(groupId, { text: `![:Person](${rcUserId}) Google Drive account not found. Please message me with \`login\` to login.` });
            res.status(200);
            res.json('OK')
            return;
        }

        switch (body.data.actionType) {
            case 'unAuthCard':
                const unAuthCard = authorizationHandler.getUnAuthCard(googleUser.email, rcUserId, bot.id);
                await bot.sendAdaptiveCard(createGroupResponse.id, unAuthCard);
                break;
            case 'subCard':
                const subscribeCardResponse = cardBuilder.buildSubscribeCard(bot.id);
                await bot.sendAdaptiveCard(groupId, subscribeCardResponse.card);
                break;
            case 'listCard':
                const subscriptionListCardResponse = await cardBuilder.buildSubscriptionListCard(bot.id, groupId);
                if (subscriptionListCardResponse.isSuccessful) {
                    await bot.sendAdaptiveCard(groupId, subscriptionListCardResponse.card);
                }
                else {
                    await bot.sendMessage(groupId, { text: subscriptionListCardResponse.errorMessage });
                }
                break;
            case 'unAuth':
                await subscriptionHandler.stopSubscriptionForUser(googleUser);
                await revokeToken(googleUser);
                await googleUser.destroy();
                await bot.sendMessage(createGroupResponse.id, { text: "Successfully logged out." });
                break;
            case 'subscribe':
                const links = body.data.inputLinks.split(';');
                const fileIdRegex = new RegExp('.+google.com/.+?/d/(.+)/.+');

                for (const link of links) {
                    const match = link.match(fileIdRegex);
                    if (match) {
                        //subscribe
                        const fileId = match[1];
                        const { subscriptionFileState, fileName } = await subscriptionHandler.addFileSubscription(googleUser, groupId, botId, fileId, body.data.state, body.data.hourOfDay, body.data.dayOfWeek, body.data.timezoneOffset, rcUserId, `${body.user.firstName} ${body.user.lastName}`);
                        switch (subscriptionFileState) {
                            case 'OK':
                                await bot.sendMessage(groupId, { text: `**Subscription created**. Now watching new comment events for file: **${fileName}**.` });
                                break;
                            case 'Duplicated':
                                await bot.sendMessage(groupId, { text: `**Failed to create**. Subscription for file: **${fileName}** already exists.` });
                                break;
                            case 'NotFound':
                                await bot.sendMessage(groupId, { text: `**Failed to create**. Unable to find file with id: ${fileId}` });
                                break;
                        }
                    }
                }
                break;
            case 'subscriptionConfig':
                const subscribeCardTemplate = new Template(subscribeCardTemplateJson);
                const subscribeCardData = {
                    mode: 'config',
                    title: 'Subscription Config',
                    subscriptionId: body.data.subscriptionId,
                    fileId: body.data.fileId,
                    iconLink: body.data.iconLink,
                    fileName: body.data.fileName,
                    rcUseName: body.data.rcUserName,
                    botId: bot.id,
                    subscriptionState: body.data.subscriptionState
                }
                const subscribeCard = subscribeCardTemplate.expand({
                    $root: subscribeCardData
                });
                console.log(JSON.stringify(subscribeCard, null, 2));
                await bot.sendAdaptiveCard(groupId, subscribeCard);
                break;
            case 'muteSubscription':
                await subscriptionHandler.muteSubscription(bot.id, groupId, body.data.fileId);
                await bot.sendMessage(groupId, { text: `**Muted file**: **${body.data.fileName}**` });
                break;
            case 'updateSubscription':
                await subscriptionHandler.setSubscriptionStateAndStartTime(bot.id, groupId, body.data.fileId, body.data.state, body.data.hourOfDay, body.data.dayOfWeek, body.data.timezoneOffset);
                await bot.sendMessage(groupId, { text: `**Updated file**: **${body.data.fileName}**` });
                break;
            case 'unsubscribe':
                await subscriptionHandler.removeFileFromSubscription(bot.id, groupId, body.data.fileId);
                await bot.sendMessage(groupId, { text: `**Unsubscribed file**: **${body.data.fileName}**` });
                break;
            case 'replyComment':
                await checkAndRefreshAccessToken(googleUser);
                const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });
                try {
                    await drive.replies.create({
                        commentId: body.data.commentId,
                        fileId: body.data.fileId,
                        fields: '*',
                        requestBody: {
                            content: body.data.replyText
                        }
                    });
                    // notify user the result of the action in RingCentral App conversation
                    await bot.sendMessage(groupId, { text: 'Comment replied.' });
                }
                catch (e) {
                    if (e.response.status === 403) {
                        await bot.sendMessage(groupId, { text: `![:Person](${rcUserId}) Your Google Account (${googleUser.email}) does not have access to reply comment under this file.` });
                        res.status(200);
                        res.json('OK')
                        return;
                    }
                }
                break;
            case 'grantAccess':
                await checkAndRefreshAccessToken(googleUser);
                let isGrantAccessSuccessful = true;
                for (const grantUserInfo of body.data.googleUserInfo) {
                    isGrantAccessSuccessful = await authorizationHandler.grantFileAccessToUser(googleUser, body.data.fileId, grantUserInfo, body.data.permissionRole);
                    if (!isGrantAccessSuccessful) {
                        break;
                    }
                }
                if (isGrantAccessSuccessful) {
                    await bot.sendMessage(groupId, { text: 'Access granted.' });
                }
                else {
                    await bot.sendMessage(groupId, { text: 'Failed to grant access. Only file owner can grant access.' });
                }
                break;
            case 'turnOnNewFileShareNotification':
                await googleUser.update({
                    isReceiveNewFile: true
                })
                await bot.sendMessage(groupId, { text: 'New File Share notifications turned ON. You will START receiving notifications when there is a new file shared with you.' });
                break;
            case 'turnOffNewFileShareNotification':
                await googleUser.update({
                    isReceiveNewFile: false
                })
                await bot.sendMessage(groupId, { text: 'New File Share notifications turned OFF. You will STOP receiving notifications when there is a new file shared with you.' });
                break;
        }
    }
    catch (e) {
        console.error(e);
    }

    res.status(200);
    res.json({
        result: 'OK',
    });
}


exports.interactiveMessages = interactiveMessages;