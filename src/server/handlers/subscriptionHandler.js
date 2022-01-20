const { google } = require('googleapis')
const { Subscription } = require('../models/subscriptionModel');
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

  const checkFileResponse = await drive.files.get({ fileId, fields: 'id' });
  if (!checkFileResponse.data.id) {
    return false;
  }

  await Subscription.create({
    id: generate(),
    groupId,
    botId,
    googleUserId: googleUser.id,
    fileId
  });

  return true;
}

async function removeFileFromSubscription(googleUserId, botId, groupId, fileId) {
  console.log(`unsubscribing ${fileId}`)
  await Subscription.destroy({
    where: {
      googleUserId,
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
exports.removeFileFromSubscription = removeFileFromSubscription;