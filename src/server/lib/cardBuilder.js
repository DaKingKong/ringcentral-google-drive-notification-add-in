const { Template } = require('adaptivecards-templating');
const subscriptionListCardTemplateJson = require('../adaptiveCardPayloads/subscriptionListCard.json');
const subscribeCardTemplateJson = require('../adaptiveCardPayloads/subscribeCard.json');
const grantFileAccessCardTemplateJson = require('../adaptiveCardPayloads/grantFileAccessCard.json');
const fileInfoCardTemplateJson = require('../adaptiveCardPayloads/fileInfoCard.json');

const { Subscription } = require('../models/subscriptionModel');
const { GoogleFile } = require('../models/googleFileModel');

async function buildSubscriptionListCard(botId, groupId) {
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

function buildSubscribeCard(botId){
    const subscribeCardTemplate = new Template(subscribeCardTemplateJson);
    const subscribeCardData = {
        mode: 'sub',
        title: 'Subscribe',
        botId
    }
    const subscribeCard = subscribeCardTemplate.expand({
        $root: subscribeCardData
    });
    
    return {
        isSuccessful: true,
        card: subscribeCard
    };
}

function grantFileAccessCard(botId, googleFile, googleUserInfo){
    const grantFileAccessCardTemplate = new Template(grantFileAccessCardTemplateJson);
    const grantFileAccessCardData = {
        googleUserInfo,
        fileId: googleFile.id,
        fileName: googleFile.name,
        fileIconUrl: googleFile.iconLink,
        fileOwnerEmail: googleFile.ownerEmail,
        botId
    }
    const grantFileAccessCard = grantFileAccessCardTemplate.expand({
        $root: grantFileAccessCardData
    });
    
    return {
        isSuccessful: true,
        card: grantFileAccessCard
    };
}

function fileInfoCard(botId, googleFile){
    const fileInfoCardTemplate = new Template(fileInfoCardTemplateJson);
    const fileInfoCardData = {
        fileId: googleFile.id,
        fileName: googleFile.name,
        fileIconUrl: googleFile.iconLink,
        fileOwnerEmail: googleFile.ownerEmail,
        fileUrl: googleFile.url,
        botId
    }
    const fileInfoCard = fileInfoCardTemplate.expand({
        $root: fileInfoCardData
    });
    
    return {
        isSuccessful: true,
        card: fileInfoCard
    };
}

exports.buildSubscriptionListCard = buildSubscriptionListCard;
exports.buildSubscribeCard = buildSubscribeCard;
exports.grantFileAccessCard = grantFileAccessCard;
exports.fileInfoCard = fileInfoCard;