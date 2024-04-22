const { google } = require('googleapis')
const { Subscription } = require('../models/subscriptionModel');
const { GoogleFile } = require('../models/googleFileModel');
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const { generate } = require('shortid');
const moment = require('moment');
const { GoogleUser } = require('../models/googleUserModel');

async function createGlobalSubscription(googleUser) {
  await checkAndRefreshAccessToken(googleUser);
  const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });

  // Step.1: [INSERT]Create a new webhook subscription on 3rd party platform with their API. For most cases, you would want to define what resources/events you want to subscribe to as well.
  const tokenResponse = await drive.changes.getStartPageToken();
  const pageToken = tokenResponse.data.startPageToken;
  const watchResponse = await drive.changes.watch({
    pageToken,
    pageSize: 3,
    includeCorpusRemovals: true,
    includeItemsFromAllDrives: false,
    supportsAllDrives: false,
    requestBody: {
      id: generate(),
      type: 'web_hook',
      address: `${process.env.RINGCENTRAL_CHATBOT_SERVER}/notification`,
      expiration: 86400000 + new Date().getTime(),
      payload: true
    }
  });

  console.log(`Subscription created: ${JSON.stringify(watchResponse.data)}`);

  await GoogleUser.update(
    {
      googleSubscriptionId: watchResponse.data.id,
      googleResourceId: watchResponse.data.resourceId,
      startPageToken: pageToken
    },
    {
      where: {
        id: googleUser.id
      }
    }
  );

  return true;
}

async function addFileSubscription(googleUser, groupId, botId, fileId, state, hourOfDay, dayOfWeek, timezoneOffset, rcUserId, rcUserName) {
  await checkAndRefreshAccessToken(googleUser);
  const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });

  const duplicatedFileInGroup = await Subscription.findOne({
    where: {
      groupId,
      botId,
      fileId
    }
  })

  let fileName = '';

  if (duplicatedFileInGroup) {
    const duplicatedFile = await GoogleFile.findByPk(duplicatedFileInGroup.fileId);
    return {
      subscriptionFileState: 'Duplicated',
      fileName: duplicatedFile.name
    };
  }
  let checkFileResponse;
  try {
    checkFileResponse = await drive.files.get({ fileId, fields: 'id, name, webViewLink, iconLink, owners', supportsAllDrives: true });
  }
  catch (e) {
    // google user cannot find the file => no access
    if (e.response.status === 404) {
      return {
        subscriptionFileState: 'NotFound'
      };
    }
  }

  const existingFile = await GoogleFile.findByPk(checkFileResponse.data.id);
  if (!existingFile) {
    await GoogleFile.create({
      id: checkFileResponse.data.id,
      name: checkFileResponse.data.name,
      iconLink: checkFileResponse.data.iconLink,
      ownerEmail: checkFileResponse.data.owners ? checkFileResponse.data.owners[0].emailAddress : '',
      url: checkFileResponse.data.webViewLink
    });
    fileName = checkFileResponse.data.name;
  }
  else {
    fileName = existingFile.name;
  }

  await Subscription.create({
    id: generate(),
    groupId,
    botId,
    rcUserId,
    rcUserName,
    googleUserId: googleUser.id,
    fileId,
    // If state is not realtime, we need user to configure push notification frequency, so create sub as 'muted' until it's configured
    state: state === 'realtime' ? 'realtime' : 'muted',
    cachedInfo: { commentNotifications: [] }
  });

  if (state !== 'realtime') {
    await setSubscriptionStateAndStartTime(botId, groupId, fileId, state, hourOfDay, dayOfWeek, timezoneOffset);
  }
  return {
    subscriptionFileState: 'OK',
    fileName
  };
}

// hourOfDay 0,1,2...23; dayOfWeek 1,2,3...7
async function setSubscriptionStateAndStartTime(botId, groupId, fileId, state, hourOfDay, dayOfWeek, timezoneOffset) {
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
    return;
  }

  const nowDate = new Date();
  let hourOfDayUtc = hourOfDay - timezoneOffset;
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
      startTime = moment(nowDate).utc().add(dayOffset, 'days').hours(hourOfDayUtc).minute(0).second(0).millisecond(0);
      break;
    case 'weekly':
      const dayOfWeekUtc = Number(dayOfWeek) + dayOffset;
      startTime = moment(nowDate).utc().day(dayOfWeekUtc).hours(hourOfDayUtc).minute(0).second(0).millisecond(0);
      break;
  }

  await Subscription.update(
    {
      state,
      startTime
    },
    {
      where: {
        id: subscription.id
      }
    }
  )
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
    return;
  }

  await Subscription.update(
    {
      state: 'muted'
    },
    {
      where: {
        id: subscription.id
      }
    }
  )
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
}

async function stopSubscriptionForUser(googleUser) {
  await checkAndRefreshAccessToken(googleUser);
  const drive = google.drive({ version: 'v3', headers: { Authorization: `Bearer ${googleUser.accessToken}` } });

  try {
    await drive.channels.stop({
      requestBody: {
        id: googleUser.googleSubscriptionId,
        resourceId: googleUser.googleResourceId
      }
    });
  }
  catch (e) {
    console.log(e.message);
  }

  const existingSubs = await Subscription.findAll({
    where: {
      googleUserId: googleUser.id
    }
  });

  for (const sub of existingSubs) {
    await sub.destroy();
  }

  console.log(`stopped subscription for user ${googleUser.email}`);
}

async function refreshSubscriptionForUser(googleUser) {
  try {
    await stopSubscriptionForUser(googleUser);
  }
  catch (e) {
    console.log(`${googleUser.email}'s old subscription already expired.`);
  }
  await createGlobalSubscription(googleUser);
}

exports.createGlobalSubscription = createGlobalSubscription;
exports.addFileSubscription = addFileSubscription;
exports.setSubscriptionStateAndStartTime = setSubscriptionStateAndStartTime;
exports.muteSubscription = muteSubscription;
exports.removeFileFromSubscription = removeFileFromSubscription;
exports.stopSubscriptionForUser = stopSubscriptionForUser;
exports.refreshSubscriptionForUser = refreshSubscriptionForUser;