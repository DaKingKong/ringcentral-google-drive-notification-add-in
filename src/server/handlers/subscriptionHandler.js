const { generate } = require('shortid');
const { google } = require('googleapis')
const { Subscription } = require('../models/subscriptionModel');
const { checkAndRefreshAccessToken } = require('../lib/oauth');

async function onSubscribe(googleUser, groupId, botId, fileId) {
  await checkAndRefreshAccessToken(googleUser);
  const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });

  try {
    const checkFileResponse = await drive.files.get({ fileId, fields: 'id' });
    console.log(JSON.stringify(checkFileResponse));
    if (!checkFileResponse.data.id) {
      return false;
    }
  }
  catch (e) {
    console.error(e.message);
    return false;
  }

  const existingSubscription = await Subscription.findOne({
    where: {
      googleUserId: googleUser.id,
      groupId
    }
  });
  // case #1: existing subscription - add a file
  if (existingSubscription) {
    const existingSubscriptions = existingSubscription.subscriptions;
    console.log(existingSubscriptions);
    existingSubscriptions.fileIds.push(fileId);
    await existingSubscription.update({
      subscriptions: existingSubscriptions
    });
  }
  // case #2: non-existing subscription - create a new subscription with the new file
  else {
    // Generate an unique id
    // Note: notificationCallbackUrl here would contain our subscriptionId so that incoming notifications can be identified
    const subscriptionId = generate();
    const notificationCallbackUrl = `${process.env.RINGCENTRAL_CHATBOT_SERVER}/notification?subscriptionId=${subscriptionId}`;

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
        address: notificationCallbackUrl,
        expiration: 86400000 + new Date().getTime(),
        payload: true
      }
    });

    console.log(`Subscription created: ${JSON.stringify(watchResponse.data)}`);

    // Step.3: Create new subscription in DB. Note: If up till now, it's running correctly, most likely your RingCentral App conversation will receive message in the form of Adaptive Card (exception: Asana - more info: try asana demo with 'npx ringcentral-add-in-framework demo')
    await Subscription.create({
      id: subscriptionId,
      googleSubscriptionId: watchResponse.data.id,
      googleResourceId: watchResponse.data.resourceId,
      groupId,
      botId,
      googleUserId: googleUser.id,
      startPageToken: pageToken,
      subscriptions: { fileIds: [fileId] },
    });
  }

  return true;
}

async function onUnsubscribe(user, rcWebhookUri) {
  const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${user.accessToken}` } });
  console.log('unsubscribing...')
  const userSubscriptions = user.subscriptions;
  const targetToUnsubscribe = userSubscriptions.find(s => s.rcWebhookUri == rcWebhookUri);
  if (targetToUnsubscribe) {
    console.log(`unsubscribing ${targetToUnsubscribe.id} with rcWebhookUri ${rcWebhookUri}`)
    const thirdPartySubscriptionId = targetToUnsubscribe.thirdPartyWebhookId;
    // [INSERT] call to delete webhook subscription from 3rd party platform
    const stopResponse = await drive.channels.stop({
      requestBody: {
        id: thirdPartySubscriptionId,
        resourceId: targetToUnsubscribe.thirdPartyResourceId
      }
    });
    console.log(`${targetToUnsubscribe.id} unsubscribed.`)

    const targetIndex = userSubscriptions.indexOf(targetToUnsubscribe);
    userSubscriptions.splice(targetIndex, 1);
    user.subscriptions = userSubscriptions;
    await user.save();

    return targetToUnsubscribe.id;
  }
}

exports.onSubscribe = onSubscribe;
exports.onUnsubscribe = onUnsubscribe;