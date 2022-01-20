const { google } = require('googleapis')
const crypto = require('crypto');
const { GoogleUser } = require('../models/googleUserModel');
const { Subscription } = require('../models/subscriptionModel');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { getOAuthApp } = require('../lib/oauth');
const { Template } = require('adaptivecards-templating');

const subscriptionHandler = require('./subscriptionHandler');
const { readlink } = require('fs');

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
                    await bot.sendMessage(body.conversation.id, { text: "Google Account not found." });
                    break;
                }

                for (const link of links) {
                    const match = link.match(fileIdRegex);
                    if (match) {
                        //subscribe
                        const fileId = match[1];
                        const isSuccessful = await subscriptionHandler.addFileSubscription(googleUser, body.conversation.id, botId, fileId);
                        if (isSuccessful) {
                            await bot.sendMessage(body.conversation.id, { text: `Comment events subscription created for file: ${fileId}.` });
                        }
                        else {
                            await bot.sendMessage(body.conversation.id, { text: `Failed to find file: ${fileId}` });
                        }
                    }
                }
                break;
            case 'unsubscribe':
                googleUser = await GoogleUser.findOne({
                    where: {
                        rcUserId: body.user.accountId
                    }
                });
                if (!googleUser) {
                    await bot.sendMessage(body.conversation.id, { text: "Google Account not found." });
                    break;
                }
                console.log(body.data.fileId)
                await subscriptionHandler.removeFileFromSubscription(googleUser.id, bot.id, body.data.groupId, body.data.fileId);
                await bot.sendMessage(body.conversation.id, { text: `Unsubscribed file: ${body.data.fileId}` });
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