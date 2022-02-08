const crypto = require('crypto');
const { GoogleUser } = require('../models/googleUserModel');
const { GoogleFile } = require('../models/googleFileModel');
const { Subscription } = require('../models/subscriptionModel');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { getOAuthApp } = require('../lib/oauth');
const Op = require('sequelize').Op;
const { Template } = require('adaptivecards-templating');
const rcAPI = require('../lib/rcAPI');

const subscriptionHandler = require('./subscriptionHandler');
const subscriptionListCardTemplateJson = require('../adaptiveCardPayloads/subscriptionListCard.json');

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

        let googleUser;

        switch (body.data.actionType) {
            case 'auth':
                const oauthApp = getOAuthApp();
                const authorizeUrl = `${oauthApp.code.getUri({
                    state: `botId=${botId}&rcUserId=${body.user.accountId}`
                })}&access_type=offline`;
                // Create/Find DM conversation to the RC user
                const createGroupResponse = await rcAPI.createConversation([body.user.accountId], bot.token.access_token);
                await bot.sendMessage(createGroupResponse.id, { text: `![:Person](${body.user.accountId}), please click link to authorize: ${authorizeUrl}` });
                res.status(200);
                res.send('OK');
                return;
            case 'subscribe':
                const links = body.data.inputLinks.split(';');
                const fileIdRegex = new RegExp('.+google.com/.+?/d/(.+)/.+');
                googleUser = await GoogleUser.findOne({
                    where: {
                        rcUserId: body.user.accountId
                    }
                });
                if (!googleUser) {
                    await bot.sendMessage(groupId, { text: "Google Account not found." });
                    break;
                }

                for (const link of links) {
                    const match = link.match(fileIdRegex);
                    if (match) {
                        //subscribe
                        const fileId = match[1];
                        const subscriptionFileState = await subscriptionHandler.addFileSubscription(googleUser, groupId, botId, fileId, body.data.state);
                        switch (subscriptionFileState) {
                            case 'OK':
                                await bot.sendMessage(groupId, { text: `Subscription created. Now watching new comment events for file: ${fileId}.` });
                                break;
                            case 'Duplicated':
                                await bot.sendMessage(groupId, { text: `Failed to create. Subscription for file: ${fileId} already exists.` });
                                break;
                            case 'Resumed':
                                await bot.sendMessage(groupId, { text: `Subscription resumed. Subscription for file: ${fileId} RESUMED.` });
                                break;
                            case 'NotFound':
                                await bot.sendMessage(groupId, { text: `Failed to create. Unable to find file: ${fileId}` });
                                break;
                        }
                    }
                }
                break;
            case 'digestConfiguration':
                await subscriptionHandler.setSubscriptionStateAndStartTime(botId, groupId, body.data.fileId, body.data.state, body.data.hourOfDay, body.data.dayOfWeek);
                break;
            case 'mute':
                googleUser = await GoogleUser.findOne({
                    where: {
                        rcUserId: body.user.accountId
                    }
                });
                if (!googleUser) {
                    await bot.sendMessage(groupId, { text: "Google Account not found." });
                    break;
                }
                await subscriptionHandler.muteSubscription(bot.id, groupId, body.data.fileId);
                await bot.sendMessage(groupId, { text: `Muted file: ${body.data.fileId}` });
                break;
            case 'resume':
                googleUser = await GoogleUser.findOne({
                    where: {
                        rcUserId: body.user.accountId
                    }
                });
                if (!googleUser) {
                    await bot.sendMessage(groupId, { text: "Google Account not found." });
                    break;
                }
                await subscriptionHandler.resumeSubscription(bot.id, groupId, body.data.fileId);
                await bot.sendMessage(groupId, { text: `Resumed file: ${body.data.fileId}` });
                break;
            case 'unsubscribe':
                googleUser = await GoogleUser.findOne({
                    where: {
                        rcUserId: body.user.accountId
                    }
                });
                if (!googleUser) {
                    await bot.sendMessage(groupId, { text: "Google Account not found." });
                    break;
                }
                await subscriptionHandler.removeFileFromSubscription(bot.id, groupId, body.data.fileId);
                await bot.sendMessage(groupId, { text: `Unsubscribed file: ${body.data.fileId}` });
                break;
            case 'activeSubList':
            case 'mutedSubList':
                googleUser = await GoogleUser.findOne({
                    where: {
                        rcUserId: body.user.accountId
                    }
                });
                if (!googleUser) {
                    await botForMessage.sendMessage(cmdGroup.id, { text: "Google Account not found." });
                }

                const subscriptionListCardTemplate = new Template(subscriptionListCardTemplateJson);
                // stateCondition: If 'mutedSubList', then return all 'muted' subs. If not, then return all non-'muted' subs
                // [Op.ne]: 'muted' -> != 'muted'
                const stateCondition = body.data.actionType === 'mutedSubList' ? 'muted' : { [Op.ne]: 'muted' };
                const subscriptions = await Subscription.findAll({
                    where: {
                        botId,
                        groupId: groupId,
                        state: stateCondition
                    }
                });
                let subscriptionList = [];;
                for (const subscription of subscriptions) {
                    const fileId = subscription.fileId;
                    const file = await GoogleFile.findByPk(fileId);
                    if (file) {
                        subscriptionList.push({
                            iconLink: file.iconLink,
                            fileName: file.name,
                            fileId,
                            botId: subscription.botId,
                            groupId: subscription.groupId,
                            subscriptionState: body.data.actionType
                        });
                    }
                }

                const subscriptionListData = {
                    listType: body.data.actionType,
                    subscriptionList
                }
                const subscriptionListCard = subscriptionListCardTemplate.expand({
                    $root: subscriptionListData
                });
                await bot.sendAdaptiveCard(groupId, subscriptionListCard);
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