const { Template } = require('adaptivecards-templating');
const subscriptionListCardTemplateJson = require('../adaptiveCardPayloads/subscriptionListCard.json');
const subscribeCardTemplateJson = require('../adaptiveCardPayloads/subscribeCard.json');
const grantFileAccessCardTemplateJson = require('../adaptiveCardPayloads/grantFileAccessCard.json');
const fileInfoCardTemplateJson = require('../adaptiveCardPayloads/fileInfoCard.json');
const authCardTemplateJson = require('../adaptiveCardPayloads/authCard.json');
const unAuthCardTemplateJson = require('../adaptiveCardPayloads/unAuthCard.json');
const newCommentCardTemplateJson = require('../adaptiveCardPayloads/newCommentCard.json');
const newFileSharedWithMeCardTemplateJson = require('../adaptiveCardPayloads/newFileShareWithMeCard.json');
const commentDigestCardTemplateJson = require('../adaptiveCardPayloads/commentDigestCard.json');
const configCardTemplateJson = require('../adaptiveCardPayloads/configCard.json');

const { Subscription } = require('../models/subscriptionModel');
const { GoogleFile } = require('../models/googleFileModel');

async function subscriptionListCard(botId, groupId) {
    const subscriptionListCardTemplate = new Template(subscriptionListCardTemplateJson);
    const subscriptions = await Subscription.findAll({
        where: {
            botId,
            groupId
        }
    });

    const activeSubscriptionList = [];;
    const mutedSubscriptionList = [];;
    for (const subscription of subscriptions) {
        const fileId = subscription.fileId;
        const file = await GoogleFile.findByPk(fileId);
        if (file) {
            if (subscription.state === 'muted') {
                mutedSubscriptionList.push({
                    iconLink: file.iconLink,
                    fileName: file.name,
                    rcUserName: subscription.rcUserName,
                    fileId,
                    botId: subscription.botId,
                    groupId: subscription.groupId,
                    subscriptionId: subscription.id,
                    subscriptionState: subscription.state
                });
            }
            else {
                activeSubscriptionList.push({
                    iconLink: file.iconLink,
                    fileName: file.name,
                    rcUserName: subscription.rcUserName,
                    fileId,
                    botId: subscription.botId,
                    groupId: subscription.groupId,
                    subscriptionId: subscription.id,
                    subscriptionState: subscription.state
                });
            }
        }
    }

    // Case: no item in list
    if (activeSubscriptionList.length === 0 && mutedSubscriptionList.length === 0) {
        return {
            isSuccessful: false,
            errorMessage: 'No subscription can be found. Please create with `sub` command.'
        }
    }

    const subscriptionListData = {
        activeSubscriptionList,
        mutedSubscriptionList,
        showActiveList: activeSubscriptionList.length > 0,
        showMutedList: mutedSubscriptionList.length > 0
    }

    const subscriptionListCard = subscriptionListCardTemplate.expand({
        $root: subscriptionListData
    });

    return {
        isSuccessful: true,
        card: subscriptionListCard
    };
}

function subscribeCard(botId) {
    const template = new Template(subscribeCardTemplateJson);
    const cardData = {
        mode: 'sub',
        title: 'Subscribe',
        botId
    }
    const card = template.expand({
        $root: cardData
    });
    return card;
}

function subscribeConfigCard(subscriptionId, fileId, iconLink, fileName, botId, subscriptionState) {
    const template = new Template(subscribeCardTemplateJson);
    const cardData = {
        mode: 'config',
        title: 'Subscription Config',
        subscriptionId,
        fileId,
        iconLink,
        fileName,
        botId,
        subscriptionState
    }
    const card = template.expand({
        $root: cardData
    });
    return card;
}


function grantFileAccessCard(botId, googleFile, googleUserInfo) {
    const template = new Template(grantFileAccessCardTemplateJson);
    const cardData = {
        googleUserInfo,
        fileId: googleFile.id,
        fileName: googleFile.name,
        fileIconUrl: googleFile.iconLink,
        fileOwnerEmail: googleFile.ownerEmail,
        botId
    }
    const card = template.expand({
        $root: cardData
    });
    return card;
}

function fileInfoCard(botId, googleFile) {
    const template = new Template(fileInfoCardTemplateJson);
    const cardData = {
        fileId: googleFile.id,
        fileName: googleFile.name,
        fileIconUrl: googleFile.iconLink,
        fileOwnerEmail: googleFile.ownerEmail,
        fileUrl: googleFile.url,
        botId
    }
    const card = template.expand({
        $root: cardData
    });
    return card;
}

function authCard(authLink) {
    const template = new Template(authCardTemplateJson);
    const cardData = {
        link: authLink,
        buttonImageUrl: `${process.env.RINGCENTRAL_CHATBOT_SERVER}/static/google-login-button.png`
    }
    const card = template.expand({
        $root: cardData
    });
    return card;
}

function unAuthCard(googleUserEmail, rcUserId, botId) {
    const template = new Template(unAuthCardTemplateJson);
    const cardData = {
        googleUserEmail,
        rcUserId,
        botId
    }
    const card = template.expand({
        $root: cardData
    });
    return card;
}

function newCommentCard(rawCardData) {
    const template = new Template(newCommentCardTemplateJson);
    const cardData = {
        userAvatar: rawCardData.userAvatar,
        username: rawCardData.username,
        userEmail: rawCardData.userEmail,
        fileIconUrl: rawCardData.fileIconUrl,
        fileName: rawCardData.fileName,
        commentContent: rawCardData.commentContent,
        quotedContent: rawCardData.quotedContent,
        fileUrl: rawCardData.fileUrl,
        commentIconUrl: rawCardData.commentIconUrl,
        userId: rawCardData.userId,
        subscriptionId: rawCardData.subscriptionId,
        commentId: rawCardData.commentId,
        fileId: rawCardData.fileId,
        botId: rawCardData.botId,
    }
    const card = template.expand({
        $root: cardData
    });
    return card;
}

function newFileShareCard(rawCardData) {
    const template = new Template(newFileSharedWithMeCardTemplateJson);
    const cardData = {
        userAvatar: rawCardData.userAvatar,
        username: rawCardData.username,
        userEmail: rawCardData.userEmail,
        fileIconUrl: rawCardData.fileIconUrl,
        fileName: rawCardData.fileName,
        fileUrl: rawCardData.fileUrl,
        fileType: rawCardData.fileType,
        ownerEmail: rawCardData.ownerEmail ? `(${rawCardData.ownerEmail})` : '',
        ownerDisplayName: rawCardData.ownerDisplayName,
        modifiedTime: rawCardData.modifiedTime,
        accessibilityVerb: rawCardData.accessibilityVerb
    };
    const card = template.expand({
        $root: cardData
    });
    return card;
}

function commentDigestCard(rawCardData) {
    const template = new Template(commentDigestCardTemplateJson);
    const card = template.expand({
        $root: rawCardData
    });
    return card;
}

function configCard(botId, isNewFileNotificationOn) {
    const configCardTemplate = new Template(configCardTemplateJson);
    const cardData = {
        botId,
        isNewFileNotificationOn
    }
    const card = configCardTemplate.expand({
        $root: cardData
    });
    return card;
}

exports.subscriptionListCard = subscriptionListCard;
exports.subscribeCard = subscribeCard;
exports.subscribeConfigCard = subscribeConfigCard;
exports.grantFileAccessCard = grantFileAccessCard;
exports.fileInfoCard = fileInfoCard;
exports.authCard = authCard;
exports.unAuthCard = unAuthCard;
exports.newCommentCard = newCommentCard;
exports.newFileShareCard = newFileShareCard;
exports.commentDigestCard = commentDigestCard;
exports.configCard = configCard;