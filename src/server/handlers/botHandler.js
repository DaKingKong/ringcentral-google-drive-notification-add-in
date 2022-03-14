
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const authorizationHandler = require('./authorizationHandler');
const { getOAuthApp } = require('../lib/oauth');
const rcAPI = require('../lib/rcAPI');
const cardBuilder = require('../lib/cardBuilder');
const { GoogleUser } = require('../models/googleUserModel');
const { Template } = require('adaptivecards-templating');
const { google } = require('googleapis')

const configCardTemplateJson = require('../adaptiveCardPayloads/configCard.json');
const { GoogleFile } = require('../models/googleFileModel');

const helperText =
    'Hi, this is **Google Drive Bot**.\n\n' +
    'My features:\n' +
    '1. Send `New File Share` notifications via Direct Message (realtime)\n' +
    '2. Send `New Comment` notifications for subscribed files to conversations (realtime, daily, weekly)\n' +
    '3. Detect `Google File Share Link` posted in conversations and check for all members accesses. File owner can then grant access.\n\n' +
    'My commands:\n' +
    '1. `@bot login`: **Login** with your Google Account\n' +
    '2. `@bot logout`: **Logout** your Google Account and **clear all** subscriptions created by it\n' +
    '3. `@bot checkauth`: **Check** team members on their Google Account login status and remind those who don\'t have Google Account authorized\n' +
    '4. `@bot sub`: **Create** a new subscription for `New Comment` under this channel\n' +
    '5. `@bot list`: **List** all subscriptions for `New Comment` under this channel'

const botHandler = async event => {
    try {
        switch (event.type) {
            case 'BotJoinGroup':
                const { group: joinedGroup, bot: joinedBot } = event;
                await joinedBot.sendMessage(joinedGroup.id, { text: helperText });
                break;
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
                    case 'login':
                        if (existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "You have already logged in." });
                        }
                        else {
                            const oauthApp = getOAuthApp();
                            const authLink = `${oauthApp.code.getUri({
                                state: `botId=${botForMessage.id}&rcUserId=${userId}`
                            })}&access_type=offline`; const authCard = authorizationHandler.getAuthCard(authLink);
                            await botForMessage.sendAdaptiveCard(createGroupResponse.id, authCard);
                        }
                        break;
                    case 'logout':
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `login` to authorize your account." });
                        }
                        else {
                            const unAuthCard = authorizationHandler.getUnAuthCard(existingGoogleUser.email, userId, botForMessage.id);
                            await botForMessage.sendAdaptiveCard(createGroupResponse.id, unAuthCard);
                        }
                        break;
                    case 'checkauth':
                        const checkAccessResult = await checkMembersGoogleAccountAuth(botForMessage, cmdGroup.id);
                        if (checkAccessResult.returnMessage) {
                            await botForMessage.sendMessage(cmdGroup.id, { text: checkAccessResult.returnMessage });
                        }
                        else {
                            await botForMessage.sendMessage(cmdGroup.id, { text: 'All members authorized.' });
                        }
                        break;
                    case 'sub':
                    case 'subscribe':
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `login` to authorize your account." });
                            break;
                        }
                        const subscribeCardResponse = cardBuilder.buildSubscribeCard(botForMessage.id);
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, subscribeCardResponse.card);
                        break;
                    case 'config':
                        if (cmdGroup.id != createGroupResponse.id) {
                            await botForMessage.sendMessage(cmdGroup.id, { text: "`config` command is only supported in Direct Message." });
                            break;
                        }
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `login` to authorize your account." });
                            break;
                        }
                        const configCardTemplate = new Template(configCardTemplateJson);
                        const configCardData = {
                            botId: botForMessage.id,
                            isNewFileNotificationOn: existingGoogleUser.isReceiveNewFile
                        }
                        const configCard = configCardTemplate.expand({
                            $root: configCardData
                        });
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, configCard);
                        break;
                    case 'list':
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `login` to authorize your account." });
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
                    case 'help':
                        await botForMessage.sendMessage(cmdGroup.id, { text: helperText });
                    default:
                        break;

                }
                break;
            case 'PostAdded':
                const { text: postText, groupId: postGroupId, creatorId } = event.message.body;
                console.log(`=====event.PostAdded=====${JSON.stringify(event)}`);
                if (postText) {
                    const googleFileLinkRegex = new RegExp('https://.+google.com/.+?/d/.+?/.+\\?usp=sharing', 'g');
                    // Note: RingCentral App converts links to [{link}](link) format...so we'd have at least 2 occurrences for 1 link input
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
                        await botForPost.sendMessage(postGroupId, { text: `Google Drive file link detected. But ![:Person](${creatorId}) doesn't have an authorized Google Account. Please @me with \`login\` command to authorize.` });
                        break;
                    }

                    const checkAccountResult = await checkMembersGoogleAccountAuth(botForPost, postGroupId);
                    if (checkAccountResult.returnMessage) {
                        await botForMessage.sendMessage(cmdGroup.id, { text: checkAccountResult.returnMessage });
                    }

                    const fileIdRegex = new RegExp('https://.+google.com/.+?/d/(.+)/.+\\?usp=sharing');
                    const fileId = googleFileLinkInPost.match(fileIdRegex)[1];

                    let googleFile = await GoogleFile.findByPk(fileId);
                    if (!googleFile) {
                        const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUserForPost.accessToken}` } });
                        try {
                            const googleFileResponse = await drive.files.get({ fileId, fields: 'id, name, webViewLink, iconLink, owners' });
                            googleFile = await GoogleFile.create({
                                id: googleFileResponse.data.id,
                                name: googleFileResponse.data.name,
                                iconLink: googleFileResponse.data.iconLink,
                                ownerEmail: googleFileResponse.data.owners[0].emailAddress,
                                url: googleFileResponse.data.webViewLink
                            });
                        }
                        // If the user posting file link cannot access the file (404), we don't do anything about this link
                        catch (e) {
                            console.log(e);
                            if (e.response.status === 404) {
                                break;
                            }
                        }
                    }

                    const fileInfoCardResponse = cardBuilder.fileInfoCard(botForPost.id, googleFile);
                    await botForPost.sendAdaptiveCard(postGroupId, fileInfoCardResponse.card);

                    const userWithoutAccessInfo = [];
                    for (const id of checkAccountResult.userIdsWithGoogleAccount) {
                        // if rc user has Google Account, subscribe to all files in links
                        const googleUserToCheckFileAccess = await GoogleUser.findOne({
                            where: {
                                rcUserId: id
                            }
                        });
                        console.log(`Checking google file access for: ${JSON.stringify(googleUserToCheckFileAccess, null, 2)} `);
                        const hasAccess = await authorizationHandler.checkUserFileAccess(googleUserToCheckFileAccess, fileId);
                        console.log(`Google User: ${googleUserToCheckFileAccess.email} ${hasAccess ? "has access" : "has no access"} to file.`);
                        if (!hasAccess) {
                            userWithoutAccessInfo.push({
                                rcUserId: id,
                                googleUserInfo: {
                                    id: googleUserToCheckFileAccess.id,
                                    email: googleUserToCheckFileAccess.email
                                }
                            });
                        }
                    }

                    if (userWithoutAccessInfo.length > 0) {
                        let noAccessMessage = 'Google Drive file link detected. Following users don\'t have access to above file\n '
                        for (const user of userWithoutAccessInfo) {
                            noAccessMessage += `![:Person](${user.rcUserId}) `;
                        }
                        await botForPost.sendMessage(postGroupId, { text: noAccessMessage });
                        const grantFileAccessCardResponse = cardBuilder.grantFileAccessCard(botForPost.id, googleFile, userWithoutAccessInfo.map(u => u.googleUserInfo));
                        await botForPost.sendAdaptiveCard(postGroupId, grantFileAccessCardResponse.card);
                    }
                }
                break;
        }
    }
    catch (e) {
        console.log(e);
    }
}

async function checkMembersGoogleAccountAuth(bot, groupId) {
    // check if all team members have Google auth
    const inGroupUserInfo = await authorizationHandler.getInGroupRcUserGoogleAccountInfo(groupId, bot.token.access_token);
    const userIdsWithoutGoogleAccount = inGroupUserInfo.rcUserIdsWithoutGoogleAccount;
    const userIdsWithGoogleAccount = inGroupUserInfo.rcUserIdsWithGoogleAccount;
    let noAccountMessage = null;
    if (userIdsWithoutGoogleAccount.length > 0) {
        noAccountMessage = 'Google Drive account not found for following users:\n\n'
        for (const userId of userIdsWithoutGoogleAccount) {
            noAccountMessage += `![:Person](${userId}) `;
        }
        noAccountMessage += '\n\nPlease @me with `login` command to authorize.';
        await bot.sendMessage(groupId, { text: noAccountMessage });
    }

    return {
        returnMessage: noAccountMessage,
        userIdsWithoutGoogleAccount,
        userIdsWithGoogleAccount
    }
}

exports.botHandler = botHandler;