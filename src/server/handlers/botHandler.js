
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const authorizationHandler = require('./authorizationHandler');
const { GoogleUser } = require('../models/googleUserModel');
const { Template } = require('adaptivecards-templating');

const subscribeCardTemplateJson = require('../adaptiveCardPayloads/subscribeCard.json');
const listOptionsCardTemplateJson = require('../adaptiveCardPayloads/listOptionsCard.json');

const botHandler = async event => {
    try {
        switch (event.type) {
            case 'Message4Bot':
                const { text: cmdText, group: cmdGroup, bot: botForMessage } = event;
                console.log('=====event.Message4Bot=====');
                console.log(`=====incomingCommand.Message4Bot.${cmdText}=====`);
                switch (cmdText.toLowerCase()) {
                    case 'hello':
                        await botForMessage.sendMessage(cmdGroup.id, { text: 'hello' });
                        break;
                    case 'auth':
                        const authCard = authorizationHandler.getAuthCard(botForMessage.id);
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, authCard);
                        break;
                    case 'sub':
                    case 'subscribe':
                        const subscribeCardTemplate = new Template(subscribeCardTemplateJson);
                        const subscribeCardData = {
                            botId: botForMessage.id
                        }
                        const subscribeCard = subscribeCardTemplate.expand({
                            $root: subscribeCardData
                        });
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, subscribeCard);
                        break;
                    case 'list':
                        const listOptionsCardTemplate = new Template(listOptionsCardTemplateJson);
                        const listOptionsCardData = {
                            botId: botForMessage.id
                        }
                        const listOptionsCard = listOptionsCardTemplate.expand({
                            $root: listOptionsCardData
                        });
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, listOptionsCard);
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

                    if (rcUserIdsWithoutAccess.length > 0){
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