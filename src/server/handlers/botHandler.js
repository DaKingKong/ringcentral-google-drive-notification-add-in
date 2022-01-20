
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const subscriptionHandler = require('./subscriptionHandler');
const authorizationHandler = require('./authorizationHandler');
const { GoogleUser } = require('../models/googleUserModel');
const { Template } = require('adaptivecards-templating');

const subscribeCardTemplateJson = require('../adaptiveCardPayloads/subscribeCard.json');
const subscriptionListCardTemplateJson = require('../adaptiveCardPayloads/subscriptionListCard.json');
const { Subscription } = require('../models/subscriptionModel');
const { google } = require('googleapis');

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
                    case 'authall':
                        const userIdsWithoutGoogleAccount = await authorizationHandler.getUsersWithoutGoogleAccount(cmdGroup.id, botForMessage.token.access_token, botForMessage.id);
                        let mentionMessage = 'Please use below card button to authorize your Google Account. '
                        for (const userId of userIdsWithoutGoogleAccount) {
                            mentionMessage += `![:Person](${userId}) `;
                        }
                        console.log(mentionMessage)
                        await botForMessage.sendMessage(cmdGroup.id, { text: mentionMessage });
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
                        const googleUser = await GoogleUser.findOne({
                            where: {
                                rcUserId: event.userId
                            }
                        });
                        if (!googleUser) {
                            await botForMessage.sendMessage(cmdGroup.id, { text: "Google Account not found." });
                        }
                        const subscriptionListCardTemplate = new Template(subscriptionListCardTemplateJson);
                        const subscriptions = await Subscription.findAll({
                            where: {
                                botId: botForMessage.id,
                                groupId: cmdGroup.id,
                                googleUserId: googleUser.id
                            }
                        });
                        let subscriptionList = [];
                        const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });
                        for (const subscription of subscriptions) {
                            const fileId = subscription.fileId;
                            const file = await drive.files.get({ fileId, fields: 'id,name,iconLink' });
                            if (file) {
                                subscriptionList.push({
                                    iconLink: file.data.iconLink,
                                    fileName: file.data.name,
                                    fileId,
                                    botId: subscription.botId,
                                    groupId: subscription.groupId
                                });
                            }
                        }
                        const subscriptionListCard = subscriptionListCardTemplate.expand({
                            $root: { subscriptionList }
                        });
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, subscriptionListCard);
                        break;
                }
                break;
            // case 'PostAdded':
            //     const { text: postText, groupId: postGroupId, creatorId } = event.message.body;
            //     console.log(`=====event.PostAdded=====${JSON.stringify(event)}`);
            //     if (postText) {
            //         const googleFileLinkRegex = new RegExp('https://.+google.com/.+?/d/.+?/.+\\?usp=sharing', 'g');
            //         const matches = postText.matchAll(googleFileLinkRegex);
            //         // Jupiter converts links to [{link}](link) format...so we'd have at least 2 occurrences for 1 link input
            //         const distinctMatches = [];
            //         for (const match of matches) {
            //             if (!distinctMatches.includes(match[0])) {
            //                 distinctMatches.push(match[0]);
            //             }
            //         }

            //         if (distinctMatches.length === 0) {
            //             break;
            //         }

            //         const botForPost = await Bot.findByPk(event.message.ownerId);

            //         // if any Google file link detected, check if this GoogleUser exists
            //         const googleUserForPost = await GoogleUser.findOne({
            //             where: {
            //                 rcUserId: creatorId
            //             }
            //         });

            //         // if rc user has NO authorized Google Account, send an auth card
            //         if (!googleUserForPost) {
            //             await botForPost.sendMessage(postGroupId, { text: `Google Drive file link detected. But post owner ![:Person](${creatorId}) doesn't have an authorized Google Account. Please authorize by clicking button below and then post link(s) again.` });
            //             const authCard = authorizationHandler.getAuthCard(botForPost.id, postGroupId);
            //             await botForPost.sendAdaptiveCard(postGroupId, authCard);
            //             break;
            //         }

            //         // if rc user has Google Account, subscribe to all files in links
            //         const fileIdRegex = new RegExp('https://.+google.com/.+?/d/(.+)/.+\\?usp=sharing');
            //         for (const match of distinctMatches) {
            //             // Subscribe to the file - Note: A Google file share link example could be https://drive.google.com/file/d/{fileId}/view?usp=sharing
            //             const fileId = match.match(fileIdRegex)[1];
            //             console.log(`detecting file link with id ${fileId}`);
            //             const isSuccessful = await subscriptionHandler.addFileSubscription(googleUserForPost, postGroupId, botForPost.id, fileId);
            //             if (isSuccessful) {
            //                 await botForPost.sendMessage(postGroupId, { text: `Google Drive File Link detected. Comment events subscription created for file: ${fileId}.` });
            //             }
            //             else {
            //                 await botForPost.sendMessage(postGroupId, { text: `Google Drive File Link detected. Failed to find file: ${fileId}` });
            //             }
            //         }
            //     }
            //     break;
        }
    }
    catch (e) {
        console.log(e);
    }
}

exports.botHandler = botHandler;