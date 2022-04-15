const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const authorizationHandler = require('./authorizationHandler');
const { getOAuthApp } = require('../lib/oauth');
const rcAPI = require('../lib/rcAPI');
const cardBuilder = require('../lib/cardBuilder');
const { GoogleUser } = require('../models/googleUserModel');
const { RcUser } = require('../models/rcUserModel');
const { google } = require('googleapis')
const moment = require('moment');

const { GoogleFile } = require('../models/googleFileModel');

const helperText =
    'Hi, this is **Google Drive Bot**.\n\n' +
    'My features:\n' +
    '1. Send `New File Share` notifications via Direct Message (realtime)\n' +
    '2. Send `New Comment` notifications for subscribed files to conversations (realtime, daily, weekly)\n' +
    '3. Detect `Google File Link` posted in conversations and check for all members accesses. File owner can then grant access.\n\n' +
    'Message me **directly** with a `{command}` OR in a **team** with `@Google Drive Bot {command}`. My commands:\n' +
    '1. `login`: **Login** with your Google Account\n' +
    '2. `logout`: **Logout** your Google Account and **clear all** subscriptions created by it\n' +
    '3. `checkauth`: **Check** team members on their Google Account login status and remind those who don\'t have Google Account authorized\n' +
    '4. `sub`: **Create** a new subscription for `New Comment` under this channel\n' +
    '5. `list`: **List** all subscriptions for `New Comment` under this channel\n\n' +
    'Note: It\'s recommended to add me into a team that has `<50` members for good `response speed` and avoid `too many subscriptions` from different members.'

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
                            })}&access_type=offline`;
                            const authCard = cardBuilder.authCard(authLink);
                            await botForMessage.sendAdaptiveCard(createGroupResponse.id, authCard);
                        }
                        break;
                    case 'logout':
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `login` to authorize your account." });
                        }
                        else {
                            const unAuthCard = cardBuilder.unAuthCard(existingGoogleUser.email, userId, botForMessage.id);
                            await botForMessage.sendAdaptiveCard(createGroupResponse.id, unAuthCard);
                        }
                        break;
                    case 'checkauth':
                        checkMembersGoogleAccountAuth(botForMessage, cmdGroup.id);
                        await botForMessage.sendMessage(cmdGroup.id, { text: 'Authorizations checked. Authorization Cards are sent.' });
                        break;
                    case 'sub':
                    case 'subscribe':
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `login` to authorize your account." });
                            break;
                        }
                        const subscribeCard = cardBuilder.subscribeCard(botForMessage.id);
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, subscribeCard);
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
                        const configCard = cardBuilder.configCard(botForMessage.id, existingGoogleUser.isReceiveNewFile);
                        await botForMessage.sendAdaptiveCard(cmdGroup.id, configCard);
                        break;
                    case 'list':
                        if (!existingGoogleUser) {
                            await botForMessage.sendMessage(createGroupResponse.id, { text: "Google Drive account not found. Please type `login` to authorize your account." });
                            break;
                        }
                        const subscriptionListCardResponse = await cardBuilder.subscriptionListCard(botForMessage.id, cmdGroup.id);
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
                    const googleFileLinkRegex = new RegExp('https://.+google.com/.+?/d/(.+)/.+', 'g');
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
                        await botForPost.sendMessage(postGroupId, { text: `Google Drive file link detected. But you don't have an authorized Google Account. Please @mention **Google Drive Bot** with \`login\` command so I may verify your access to the Google Doc.` });
                        break;
                    }

                    const checkAccountResult = await checkMembersGoogleAccountAuth(botForPost, postGroupId);

                    const fileIdRegex = new RegExp('https://.+google.com/.+?/d/(.+)/.+');
                    const fileId = googleFileLinkInPost.match(fileIdRegex)[1];

                    let googleFile = await GoogleFile.findByPk(fileId);
                    if (!googleFile) {
                        const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUserForPost.accessToken}` } });
                        try {
                            const googleFileResponse = await drive.files.get({ fileId, fields: 'id, name, webViewLink, iconLink, owners', supportsAllDrives: true });
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

                    const fileInfoCard = cardBuilder.fileInfoCard(botForPost.id, googleFile);
                    await botForPost.sendAdaptiveCard(postGroupId, fileInfoCard);

                    const userWithoutAccessInfo = [];
                    for (const id of checkAccountResult.userIdsWithGoogleAccount) {
                        // if rc user has Google Account, subscribe to all files in links
                        const googleUserToCheckFileAccess = await GoogleUser.findOne({
                            where: {
                                rcUserId: id
                            }
                        });
                        const hasAccess = await authorizationHandler.checkUserFileAccess(googleUserToCheckFileAccess, fileId);
                        if (!hasAccess) {
                            const rcUserName = checkAccountResult.userIdsAndNamesWithGoogleAccount.find(u => u.id == id).name;
                            userWithoutAccessInfo.push({
                                rcUserInfo:
                                {
                                    id,
                                    name: rcUserName
                                },
                                googleUserInfo: {
                                    id: googleUserToCheckFileAccess.id,
                                    email: googleUserToCheckFileAccess.email
                                }
                            });
                        }
                    }

                    if (userWithoutAccessInfo.length > 0) {
                        const grantFileAccessCard = cardBuilder.grantFileAccessCard(botForPost.id, googleFile, userWithoutAccessInfo.map(u => u.googleUserInfo), userWithoutAccessInfo.map(u => u.rcUserInfo.name));
                        await botForPost.sendAdaptiveCard(postGroupId, grantFileAccessCard);
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
    if (userIdsWithoutGoogleAccount.length > 0) {
        for (const userId of userIdsWithoutGoogleAccount) {
            const rcUser = await RcUser.findByPk(userId);
            const nowDate = new Date();
            const dmGroupResponse = await rcAPI.createConversation([userId], bot.token.access_token);
            const dmGroupId = dmGroupResponse.id;

            const oauthApp = getOAuthApp();
            const authLink = `${oauthApp.code.getUri({
                state: `botId=${bot.id}&rcUserId=${userId}`
            })}&access_type=offline`;
            const authCard = cardBuilder.authCard(authLink, 'This card is generated from an automatic access check that is triggered by Google File link posted in a conversation. It will NOT show again within a month.');
            if (rcUser) {
                if (moment(nowDate).unix() > moment(rcUser.authReminderExpiryDateTime).unix()) {
                    await bot.sendAdaptiveCard(dmGroupId, authCard);
                    await rcUser.update({
                        authReminderExpiryDateTime: moment(nowDate).add(1, 'month')
                    });
                }
            }
            else {
                await RcUser.create({
                    id: userId,
                    authReminderExpiryDateTime: moment(nowDate).add(1, 'month')
                });
                await bot.sendAdaptiveCard(dmGroupId, authCard);
            }
        }
    }

    return {
        userIdsWithoutGoogleAccount,
        userIdsWithGoogleAccount,
        userIdsAndNamesWithGoogleAccount: inGroupUserInfo.rcUserIdsAndNamesWithGoogleAccount
    }
}

exports.botHandler = botHandler;