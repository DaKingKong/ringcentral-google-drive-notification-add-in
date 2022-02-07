const { google } = require('googleapis')
const { Subscription } = require('../models/subscriptionModel');
const { GoogleFile } = require('../models/googleFileModel');
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const { generate } = require('shortid');

async function createGlobalSubscription(googleUser, botId) {
  await checkAndRefreshAccessToken(googleUser);
  const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });

  // Step.1: [INSERT]Create a new webhook subscription on 3rd party platform with their API. For most cases, you would want to define what resources/events you want to subscribe to as well.
  const currentDate = new Date();//TODO: to be deleted
  const tokenResponse = await drive.changes.getStartPageToken();
  const pageToken = tokenResponse.data.startPageToken;
  const watchResponse = await drive.changes.watch({
    pageToken,
    pageSize: 3,
    includeCorpusRemovals: true,
    includeTeamDriveItems: true,
    supportsTeamDrives: true,
    requestBody: {
      id: `${currentDate.getDate()}-${currentDate.getHours()}-${currentDate.getMinutes()}-${currentDate.getSeconds()}`,
      type: 'web_hook',
      address: `${process.env.RINGCENTRAL_CHATBOT_SERVER}/notification`,
      expiration: 86400000 + new Date().getTime(),
      payload: true
    }
  });

  console.log(`Subscription created: ${JSON.stringify(watchResponse.data)}`);

  await googleUser.update({
    googleSubscriptionId: watchResponse.data.id,
    googleResourceId: watchResponse.data.resourceId,
    startPageToken: pageToken,
  })

  return true;
}

async function addFileSubscription(googleUser, groupId, botId, fileId) {
  await checkAndRefreshAccessToken(googleUser);
  const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });

  const duplicatedFileInGroup = await Subscription.findOne({
    where: {
      groupId,
      botId,
      fileId
    }
  })

  if (duplicatedFileInGroup) {
    if (duplicatedFileInGroup.state === 'muted') {
      await resumeSubscription(botId, groupId, fileId);
      return 'Resumed';
    }

    return 'Duplicated';
  }

  const checkFileResponse = await drive.files.get({ fileId, fields: 'id, name, iconLink' });
  if (!checkFileResponse.data.id) {
    return 'NotFound';
  }

  const existingFile = await GoogleFile.findByPk(checkFileResponse.data.id);
  if (!existingFile) {
    await GoogleFile.create({
      id: checkFileResponse.data.id,
      name: checkFileResponse.data.name,
      iconLink: checkFileResponse.data.iconLink
    });
  }

  await Subscription.create({
    id: generate(),
    groupId,
    botId,
    googleUserId: googleUser.id,
    fileId,
    state: 'realtime'
  });

  return 'OK';
}

async function setSubscriptionStateAndStartTime(botId, groupId, fileId, state, startTime) {
  console.log(`change ${fileId}, with bot: ${botId} and group: ${groupId}`)
  const subscription = await Subscription.findOne({
    where: {
      botId,
      groupId,
      fileId
    }
  })
  if (!subscription) {
    console.error('subscription not found.')
  }

  await subscription.update({
    state,
    startTime
  });
}

async function muteSubscription(botId, groupId, fileId) {
  console.log(`pausing ${fileId}, with bot: ${botId} and group: ${groupId}`)
  const subscription = await Subscription.findOne({
    where: {
      botId,
      groupId,
      fileId
    }
  })
  if (!subscription) {
    console.error('subscription not found.')
  }
  const state = subscription.state;
  await subscription.update({
    state: 'muted',
    stateBeforeMuted: state
  });
}

async function resumeSubscription(botId, groupId, fileId) {
  console.log(`resuming ${fileId}, with bot: ${botId} and group: ${groupId}`)
  const subscription = await Subscription.findOne({
    where: {
      botId,
      groupId,
      fileId
    }
  })
  if (!subscription) {
    console.error('subscription not found.')
  }
  const stateBeforeMuted = subscription.stateBeforeMuted;
  await subscription.update({
    state: stateBeforeMuted
  });
}

async function removeFileFromSubscription(botId, groupId, fileId) {
  console.log(`unsubscribing ${fileId}, with bot: ${botId} and group: ${groupId}`)
  await Subscription.destroy({
    where: {
      botId,
      groupId,
      fileId
    }
  });
  // [INSERT] call to delete webhook subscription from 3rd party platform
  // const stopResponse = await drive.channels.stop({
  //   requestBody: {
  //     id: thirdPartySubscriptionId,
  //     resourceId: targetToUnsubscribe.thirdPartyResourceId
  //   }
  // });
  // console.log(`${targetToUnsubscribe.id} unsubscribed.`)
}

exports.createGlobalSubscription = createGlobalSubscription;
exports.addFileSubscription = addFileSubscription;
exports.muteSubscription = muteSubscription;
exports.resumeSubscription = resumeSubscription;
exports.removeFileFromSubscription = removeFileFromSubscription;