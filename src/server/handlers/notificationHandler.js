const { google } = require('googleapis')
const moment = require('moment');
const { GoogleUser } = require('../models/googleUserModel');
const { GoogleFile } = require('../models/googleFileModel');
const { Subscription } = require('../models/subscriptionModel');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const cardBuilder = require('../lib/cardBuilder');

const NEW_EVENT_TIME_THRESHOLD_IN_SECONDS = 30

function isEventNew(dateTime1, dateTime2) {
    const timeDiff = moment(dateTime1).diff(dateTime2, 'seconds');
    console.log(`Time Diff: ${dateTime1} and ${dateTime2} : ${timeDiff}`);
    return timeDiff < NEW_EVENT_TIME_THRESHOLD_IN_SECONDS && timeDiff >= 0;
}

async function notification(req, res) {
    try {
        console.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
        // Identify which user or subscription is relevant, normally by 3rd party webhook id or user id. 
        const googleSubscriptionId = req.headers['x-goog-channel-id'];
        const googleUser = await GoogleUser.findOne({
            where: {
                googleSubscriptionId
            }
        });
        if (!googleUser) {
            res.status(403);
            res.send('Unknown googleSubscriptionId');
            return;
        }
        await checkAndRefreshAccessToken(googleUser);
        await onReceiveNotification(googleUser);
    } catch (e) {
        console.error(e);
    }

    res.status(200);
    res.json({
        result: 'OK',
    });
}
async function onReceiveNotification(googleUser) {
    const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });

    const listResponse = await drive.changes.list({ pageToken: googleUser.startPageToken });
    console.log(`List Response: ${JSON.stringify(listResponse.data)}`);
    // IF: reaching the end of this page, refresh startPageToken
    if (listResponse.data.newStartPageToken) {
        await googleUser.update({
            startPageToken: listResponse.data.newStartPageToken
        });
    }

    const bot = await Bot.findByPk(googleUser.botId);
    const latestChanges = listResponse.data.changes.filter(change => change.type === 'file');
    console.log(`Latest changes: ${JSON.stringify(latestChanges, null, 2)}`)
    for (const change of latestChanges) {
        const fileId = change.fileId;
        const fileResponse = await drive.files.get({ fileId, fields: 'id,name,webViewLink,iconLink,owners,viewedByMe,sharedWithMeTime,modifiedTime,ownedByMe,mimeType', supportsAllDrives: true })
        const fileData = fileResponse.data;
        const googleFile = await GoogleFile.findByPk(fileId);

        // If file name is changed, update that in db
        if (googleFile && fileData.name != googleFile.name) {
            await googleFile.update({
                name: fileData.name
            });
        }

        // Case: New File Share With Me
        if (!fileData.ownedByMe && googleUser.isReceiveNewFile && fileData.sharedWithMeTime && isEventNew(change.time, fileData.sharedWithMeTime)) {
            console.log('===========NEW FILE============');
            console.log('drive.files.get:', fileData)
            const owner = fileData.owners[0];
            const cardData = {
                userAvatar: owner.photoLink ?? "https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png",
                username: owner.displayName,
                userEmail: owner.emailAddress ?? "",
                fileIconUrl: fileData.iconLink,
                fileName: fileData.name,
                fileUrl: fileData.webViewLink,
                fileType: getFileTypeFromMimeType(fileData.mimeType),
                ownerEmail: fileData.owners[0].emailAddress,
                ownerDisplayName: fileData.owners[0].displayName,
                modifiedTime: fileData.modifiedTime
            };
            const card = cardBuilder.newFileShareCard(cardData);
            // Send adaptive card to your channel in RingCentral App
            await bot.sendAdaptiveCard(googleUser.rcDMGroupId, card);
        }
        // Case: New Comment
        else {
            const subscriptions = await Subscription.findAll({
                where: {
                    fileId,
                    googleUserId: googleUser.id
                }
            })
            // Ignore file if there's no subscription
            if (subscriptions.length === 0) {
                continue;
            }

            // Send to all channels that subscribe to this file
            for (const subscription of subscriptions) {
                const commentResponse = await drive.comments.list({ fileId, pageSize: 1, fields: '*' });
                const commentData = commentResponse.data.comments[0];
                if (!commentData) {
                    continue;
                }
                // NewComment = Comment with no Reply
                const isNewComment = commentData.replies == null || commentData.replies.length === 0;
                console.log('drive.comments.get:', JSON.stringify(commentData, null, 2));
                console.log('drive.comments.get:', subscription.lastPushedCommentId);
                if (isEventNew(change.time, commentData.modifiedTime) && isNewComment && subscription.lastPushedCommentId != commentData.id) {
                    console.log('===========NEW COMMENT============');
                    await subscription.update({
                        lastPushedCommentId: commentData.id
                    })
                    const cardData =
                    {
                        userAvatar: commentData.author.photoLink ?? "https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png",
                        username: commentData.author.displayName,
                        userEmail: commentData.author.emailAddress ?? "",
                        fileIconUrl: fileData.iconLink,
                        fileName: fileData.name,
                        commentContent: commentData.content,
                        quotedContent: commentData.quotedFileContent?.value ?? "",
                        fileUrl: fileData.webViewLink,
                        commentIconUrl: "https://lh3.googleusercontent.com/UeyfqNkFySLGNweD_KkSUPrMoUekF17KLqeWi18L2UwZZZrEbVl8vNledRTp2iRqJUE=w36",
                        userId: googleUser.id,
                        subscriptionId: subscription.id,
                        commentId: commentData.id,
                        fileId: fileId,
                        botId: bot.id
                    };
                    if (subscription.state === 'muted') {
                        continue;
                    }
                    else if (subscription.state === 'realtime') {
                        const card = cardBuilder.newCommentCard(cardData);
                        // Send adaptive card to your channel in RingCentral App
                        await bot.sendAdaptiveCard(subscription.groupId, card);
                    }
                    // daily, weekly -> cache
                    else if (subscription.state === 'daily' || subscription.state === 'weekly') {
                        const cachedInfo = subscription.cachedInfo;
                        cachedInfo.commentNotifications.push(cardData);
                        await subscription.update({
                            cachedInfo
                        });
                    }
                }
            }
        }
    }
}

async function SendDigestNotification(subscriptions) {
    if (subscriptions.length === 0) {
        return;
    }

    const bot = await Bot.findByPk(subscriptions[0].botId);
    const groupIds = [];
    for (const sub of subscriptions) {
        if (!groupIds.includes(sub.groupId)) {
            groupIds.push(sub.groupId);
        }
    }

    for (const groupId of groupIds) {
        const subscriptionsInGroup = subscriptions.filter(s => s.groupId == groupId);
        let cardData =
        {
            commentNotifications: []
        }

        for (const sub of subscriptionsInGroup) {
            if (sub.cachedInfo.commentNotifications.length === 0) {
                continue;
            }
            console.log(`notification to trigger count: ${sub.cachedInfo.commentNotifications.length}`);
            cardData.commentNotifications = cardData.commentNotifications.concat(sub.cachedInfo.commentNotifications);
        }

        const card = cardBuilder.commentDigestCard(cardData);
        // Send adaptive card to your channel in RingCentral App
        await bot.sendAdaptiveCard(groupId, card);

        // Clear db data only if all info is sent successfully
        for (const sub of subscriptionsInGroup) {
            await sub.update({
                cachedInfo: {
                    commentNotifications: []
                }
            });
        }
    }
}

function getFileTypeFromMimeType(mimeType) {
    switch (mimeType) {
        case 'application/vnd.google-apps.document':
            return 'document';
        case 'application/vnd.google-apps.folder':
            return 'folder';
        case 'application/vnd.google-apps.form':
            return 'form';
        case 'application/vnd.google-apps.presentation':
            return 'slide';
        case 'application/vnd.google-apps.spreadsheet':
            return 'spreadsheet';
        default:
            return 'file';
    }
}

exports.notification = notification;
exports.SendDigestNotification = SendDigestNotification;