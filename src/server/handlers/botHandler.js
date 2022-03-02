
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const authorizationHandler = require('./authorizationHandler');
const { getOAuthApp } = require('../lib/oauth');
const rcAPI = require('../lib/rcAPI');
const cardBuilder = require('../lib/cardBuilder');
const { GoogleUser } = require('../models/googleUserModel');
const { Template } = require('adaptivecards-templating');

const configCardTemplateJson = require('../adaptiveCardPayloads/configCard.json');

const botHandler = async event => {
    try {
        switch (event.type) {
            case 'Message4Bot':
                const { text: cmdText, group: cmdGroup, bot: botForMessage, userId } = event;
                // console.log(`=====event.Message4Bot.${JSON.stringify(event, null, 2)}=====`);
                console.log(`=====incomingCommand.Message4Bot.${cmdText}=====`);

                const existingGoogleUser = await GoogleUser.findOne({
                    where: {
                        rcUserId: userId
                    }
                })
                // Create/Find DM conversation to the RC user
                const createGroupResponse = await rcAPI.createConversation([userId], botForMessage.token.access_token);

                switch (cmdText.toLowerCase()) {
                    case 'hello':
                        await botForMessage.sendMessage(cmdGroup.id, { text: 'hello' });
                        break;
                    case 'auth':
                        if (existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "You have already authorized." });
                        }
                        else {
                            const oauthApp = getOAuthApp();
                            const authLink = `${oauthApp.code.getUri({
                                state: `botId=${botForMessage.id}&rcUserId=${userId}`
                            })}&access_type=offline`; const authCard = authorizationHandler.getAuthCard(authLink);
                            await botForMessage.sendAdaptiveCard(createGroupResponse.id, authCard);
                        }
                        break;
                    case 'sub':
                    case 'subscribe':
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `auth` to authorize your account." });
                            break;
                        }
                        const subscribeCardResponse = await cardBuilder.buildSubscribeCard(botForMessage.id);
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, subscribeCardResponse.card);
                        break;
                    case 'config':
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `auth` to authorize your account." });
                            break;
                        }
                        const configCardTemplate = new Template(configCardTemplateJson);
                        const configCardData = {
                            botId: botForMessage.id
                        }
                        const configCard = configCardTemplate.expand({
                            $root: configCardData
                        });
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, configCard);
                        break;
                    case 'list':
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `auth` to authorize your account." });
                            break;
                        }
                        const subscriptionListCardResponse = await cardBuilder.buildSubscriptionListCard(botForMessage.id, cmdGroup.id);
                        if (subscriptionListCardResponse.isSuccessful) {
                            await botForMessage.sendAdaptiveCard(cmdGroup.id, subscriptionListCardResponse.card);
                        }
                        else {
                            await botForMessage.sendMessage(cmdGroup.id, { text: subscriptionListCardResponse.errorMessage });
                        }
                        break;
                }
                break;
            case 'PostAdded':
                const { text: postText, groupId: postGroupId, creatorId } = event.message.body;
                console.log(`=====event.PostAdded=====${JSON.stringify(event)}`);
                if (postText) {
                    const googleFileLinkRegex = new RegExp('https://.+google.com/.+?/d/.+?/.+\\?usp=sharing', 'g');
                    // Note: Jupiter converts links to [{link}](link) format...so we'd have at least 2 occurrences for 1 link input
                    const matches = postText.matchAll(googleFileLinkRegex);
                    // Note: We want to limit the detection for only the 1st link. The reason is to reduce noise, because one link would generate quite some messages already
                    const firstMatch = matches.next().value;
                    if (!firstMatch) {
                        break;
                    }

                    const googleFileLinkInPost = firstMatch[0];
                    const botForPost = await Bot.findByPk(event.message.ownerId);

                    // if any Google file link detected, check if this GoogleUser exists
                    const googleUserForPost = await GoogleUser.findOne({
                        where: {
                            rcUserId: creatorId
                        }
                    });

                    // if rc user has NO authorized Google Account, send an auth card
                    if (!googleUserForPost) {
                        await botForPost.sendMessage(postGroupId, { text: `Google Drive file link detected. But post owner ![:Person](${creatorId}) doesn't have an authorized Google Account. Please authorize by clicking button below and then post link(s) again.` });
                        const authCard = authorizationHandler.getAuthCard(botForPost.id, postGroupId);
                        await botForPost.sendAdaptiveCard(postGroupId, authCard);
                        break;
                    }

                    // check if all team members have Google auth
                    const inGroupUserInfo = await authorizationHandler.getInGroupRcUserGoogleAccountInfo(postGroupId, botForPost.token.access_token, botForPost.id);
                    const userIdsWithoutGoogleAccount = inGroupUserInfo.rcUserIdsWithoutGoogleAccount;
                    const userIdsWithGoogleAccount = inGroupUserInfo.rcUserIdsWithGoogleAccount;
                    if (userIdsWithoutGoogleAccount.length > 0) {
                        let noAccountMessage = 'Please use below card button to authorize your Google Account. '
                        for (const userId of userIdsWithoutGoogleAccount) {
                            noAccountMessage += `![:Person](${userId}) `;
                        }
                        await botForPost.sendMessage(postGroupId, { text: noAccountMessage });
                        const authCard = authorizationHandler.getAuthCard(botForPost.id, postGroupId);
                        await botForPost.sendAdaptiveCard(postGroupId, authCard);
                    }

                    const rcUserIdsWithoutAccess = [];
                    for (const id of userIdsWithGoogleAccount) {
                        // if rc user has Google Account, subscribe to all files in links
                        const fileIdRegex = new RegExp('https://.+google.com/.+?/d/(.+)/.+\\?usp=sharing');
                        const fileId = googleFileLinkInPost.match(fileIdRegex)[1];
                        const hasAccess = await authorizationHandler.checkUserFileAccess(googleUserForPost, fileId);
                        if (!hasAccess) {
                            rcUserIdsWithoutAccess.push(id);
                        }
                    }

                    if (rcUserIdsWithoutAccess.length > 0) {
                        let noAccessMessage = 'Following users don\'t have access to above file: '
                        for (const userId of rcUserIdsWithoutAccess) {
                            noAccessMessage += `![:Person](${userId}) `;
                        }
                        await botForPost.sendMessage(postGroupId, { text: noAccessMessage });
                    }
                }
                break;
        }
    }
    catch (e) {
        console.log(e);
    }
}

exports.botHandler = botHandler;