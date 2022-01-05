const { sendTextMessage, sendAdaptiveCardMessage } = require('../lib/messageHelper');
const { google } = require('googleapis')
const moment = require('moment');

const newCommentCardTemplate = require('../adaptiveCardPayloads/newCommentCard.json');
const newFileSharedWithMeCardTemplate = require('../adaptiveCardPayloads/newFileShareWithMeCard.json');

const NEW_EVENT_TIME_THRESHOLD_IN_SECONDS = 10

function isEventNew(dateTime1, dateTime2) {
    const timeDiff = moment(dateTime1).diff(dateTime2, 'seconds');
    console.log(`Time Diff: ${dateTime1} and ${dateTime2} : ${timeDiff}`);
    return timeDiff < NEW_EVENT_TIME_THRESHOLD_IN_SECONDS;
}

async function onReceiveNotification(subscription, user) {
    const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${user.accessToken}` } });

    const listResponse = await drive.changes.list({ pageToken: subscription.startPageToken });
    console.log(`List Response: ${JSON.stringify(listResponse.data)}`);
    // scenario: reaching the end of this page
    if (listResponse.data.newStartPageToken) {
        let subscriptions = user.subscriptions;
        let targetSubscription = subscriptions.find(s => s.id === subscription.id);
        targetSubscription.startPageToken = listResponse.data.newStartPageToken;
        user.subscriptions = subscriptions;
        await user.save();
    }

    const latestChanges = await listResponse.data.changes.filter(change => change.type === 'file');
    console.log(`Latest changes: ${JSON.stringify(latestChanges, null, 2)}`)
    for (const change of latestChanges) {
        const fileResponse = await drive.files.get({ fileId: change.fileId, fields: 'id,name,webViewLink,iconLink,owners,viewedByMe,sharedWithMeTime,ownedByMe' })
        const fileData = fileResponse.data;
        // Case: New Comment
        if (fileData.ownedByMe) {
            const commentResponse = await drive.comments.list({ fileId: change.fileId, pageSize: 1, fields: '*' });
            const commentData = commentResponse.data.comments[0];
            // NewComment = Comment with no Reply
            const isNewComment = commentData.replies.length === 0;
            if (isEventNew(change.time, commentData.modifiedTime) && isNewComment && !commentData.author.me) {
                console.log('===========NEW COMMENT============');
                console.log('drive.comments.get:', commentData);
                const cardData =
                {
                    userAvatar: commentData.author.photoLink ?? "https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png",
                    username: commentData.author.displayName,
                    userEmail: commentData.anchor.emailAddress ?? "",
                    documentIconUrl: fileData.iconLink,
                    documentName: fileData.name,
                    commentContent: commentData.content,
                    quotedContent: commentData.quotedFileContent.value,
                    fileUrl: fileData.webViewLink,
                    commentIconUrl: "https://lh3.googleusercontent.com/UeyfqNkFySLGNweD_KkSUPrMoUekF17KLqeWi18L2UwZZZrEbVl8vNledRTp2iRqJUE=w36",
                    userId: user.id,
                    subscriptionId: subscription.id,
                    commentId: commentData.id,
                    fileId: change.fileId
                };

                // Send adaptive card to your channel in RingCentral App
                await sendAdaptiveCardMessage(
                    subscription.rcWebhookUri,
                    newCommentCardTemplate,
                    cardData);
            }
        }
        // Case: New File Share With Me
        else {
            if (fileData.sharedWithMeTime && isEventNew(change.time, fileData.sharedWithMeTime)) {
                console.log('===========NEW FILE============');
                console.log('drive.files.get:', fileData)
                const owner = fileData.owners[0];
                const cardData = {
                    userAvatar: owner.photoLink ?? "https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png",
                    username: owner.displayName,
                    userEmail: owner.emailAddress ?? "",
                    documentIconUrl: fileData.iconLink,
                    documentName: fileData.name,
                    fileUrl: fileData.webViewLink
                };

                // Send adaptive card to your channel in RingCentral App
                await sendAdaptiveCardMessage(
                    subscription.rcWebhookUri,
                    newFileSharedWithMeCardTemplate,
                    cardData);
            }
        }
    }
}

async function onReceiveInteractiveMessage(incomingMessageData, user, subscription) {
    // Below tis the section for your customized actions handling
    // testActionType is from adaptiveCard.js - getSampleCard()
    if (incomingMessageData.action === 'replyComment') {
        // [INSERT] API call to perform action on 3rd party platform 
        const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${user.accessToken}` } });
        await drive.replies.create({
            commentId: incomingMessageData.commentId,
            fileId: incomingMessageData.fileId,
            fields: '*',
            requestBody: {
                content: incomingMessageData.replyText
            }
        });
        // notify user the result of the action in RingCentral App conversation
        await sendTextMessage(subscription.rcWebhookUri, 'Comment Replied.');
    }
}

exports.onReceiveNotification = onReceiveNotification;
exports.onReceiveInteractiveMessage = onReceiveInteractiveMessage;