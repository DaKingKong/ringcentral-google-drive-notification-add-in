const constants = require('../lib/constants');
const { generate } = require('shortid');
const { google } = require('googleapis')

async function onSubscribe(user, rcWebhookUri) {
  // Generate an unique id
  // Note: notificationCallbackUrl here would contain our subscriptionId so that incoming notifications can be identified
  const subscriptionId = generate();
  const notificationCallbackUrl = `${process.env.APP_SERVER}${constants.route.forThirdParty.NOTIFICATION}?userId=${user.id}&subscriptionId=${subscriptionId}`;

  // Step.1: [INSERT]Create a new webhook subscription on 3rd party platform with their API. For most cases, you would want to define what resources/events you want to subscribe to as well.
  const currentDate = new Date();//TODO: to be deleted
  const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${user.accessToken}` } });

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

  // Step.2: Get data from webhook creation response.
  const webhookData = {
    thirdPartySubscriptionId: watchResponse.data.id,
    thirdPartyResourceId: watchResponse.data.resourceId
  };   // [REPLACE] this with actual API call to 3rd party platform to create a webhook subscription

  // Step.3: Create new subscription in DB. Note: If up till now, it's running correctly, most likely your RingCentral App conversation will receive message in the form of Adaptive Card (exception: Asana - more info: try asana demo with 'npx ringcentral-add-in-framework demo')
  const newSubscription = {
    id: subscriptionId,
    rcWebhookUri: rcWebhookUri,
    thirdPartyWebhookId: webhookData.thirdPartySubscriptionId,   // [REPLACE] this with webhook subscription id from 3rd party platform response
    thirdPartyResourceId: webhookData.thirdPartyResourceId,
    startPageToken: pageToken,
    enabled: true
  };

  const userSubscriptions = user.subscriptions;
  userSubscriptions.push(newSubscription);
  user.subscriptions = userSubscriptions;
  await user.save();


  //If it's all good here, a Notification Card will be sent to your installed chat

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

    userSubscriptions.pop(targetToUnsubscribe);
    user.subscriptions = userSubscriptions;
    await user.save();
  }
}

exports.onSubscribe = onSubscribe;
exports.onUnsubscribe = onUnsubscribe;