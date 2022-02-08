const { google } = require('googleapis')
const { Subscription } = require('../models/subscriptionModel');
const { GoogleFile } = require('../models/googleFileModel');
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const { generate } = require('shortid');
const moment = require('moment');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;

const { Template } = require('adaptivecards-templating');
const digestConfigurationCardTemplateJson = require('../adaptiveCardPayloads/digestConfigurationCard.json');

async function createGlobalSubscription(googleUser) {
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

async function addFileSubscription(googleUser, groupId, botId, fileId, state) {
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
    // If state is not realtime, we need user to configure push notification frequency, so create sub as 'muted' until it's configured
    state: state === 'realtime' ? 'realtime' : 'muted',
    stateBeforeMuted: state
  });

  await postDigestConfigurationCard(botId, groupId, fileId, state, checkFileResponse.data.name, checkFileResponse.data.iconLink);

  return 'OK';
}

async function postDigestConfigurationCard(botId, groupId, fileId, state, fileName, iconLink) {
  const bot = await Bot.findByPk(botId);
  const cardData = {
    documentIconUrl: iconLink,
    documentName: fileName,
    state,
    botId,
    documentId: fileId
  }
  const digestConfigurationCardTemplate = new Template(digestConfigurationCardTemplateJson);
  const card = digestConfigurationCardTemplate.expand({
    $root: cardData
  });
  await bot.sendAdaptiveCard(groupId, card);
}

// hourOfDay 0,1,2...23; dayOfWeek 1,2,3...7
async function setSubscriptionStateAndStartTime(botId, groupId, fileId, state, hourOfDay, dayOfWeek, clientAppTimeStamp) {
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

  // convert to next trigger date. (Non-UTC date here yet)
  const nowDate = new Date();
  const timeZoneDiffInHours = Math.round(moment(clientAppTimeStamp).diff(nowDate, 'hours', true));
  let hourOfDayUtc = hourOfDay - timeZoneDiffInHours;
  let dayOffset = 0;
  if (hourOfDayUtc < 0) {
    dayOffset = -1;
    hourOfDayUtc += 24;
  }
  else if (hourOfDayUtc >= 24) {
    dayOffset = 1;
    hourOfDayUtc -= 24;
  }

  let startTime;
  switch (state) {
    case 'daily':
      startTime = moment(nowDate).utc().hours(hourOfDayUtc).seconds(0).minutes(0);
      break;
    case 'weekly':
      const dayOfWeekUtc = dayOfWeek + dayOffset;
      startTime = moment(nowDate).utc().day(dayOfWeekUtc).hours(hourOfDayUtc).seconds(0).minutes(0);
      break;
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
exports.setSubscriptionStateAndStartTime = setSubscriptionStateAndStartTime;
exports.muteSubscription = muteSubscription;
exports.resumeSubscription = resumeSubscription;
exports.removeFileFromSubscription = removeFileFromSubscription;