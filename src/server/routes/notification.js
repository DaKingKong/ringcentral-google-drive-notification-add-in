const { GoogleUser } = require('../models/googleUserModel');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { getOAuthApp, checkAndRefreshAccessToken } = require('../lib/oauth');
const crypto = require('crypto');
const { onReceiveNotification, onReceiveInteractiveMessage } = require('../handlers/notificationHandler');
const authCardTemplate = require('../adaptiveCardPayloads/auth.json');
//====INSTRUCTION====
// Below methods is to receive 3rd party notification and format it into Adaptive Card and send to RingCentral App conversation
// It would already send sample message if any notification comes in. And you would want to extract info from the actual 3rd party call and format it.

//====ADAPTIVE CARD DESIGN====
// Adaptive Card Designer: https://adaptivecards.io/designer/
// Add new card: Copy the whole payload in CARD PAYLOAD EDITOR from card designer and create a new .json file for it under `src/server/adaptiveCardPayloads` folder. Also remember to reference it.
async function notification(req, res) {
  try {
    const subscription = user.subscriptions.find(s => s.id == req.query.subscriptionId);
    if (!subscription) {
      res.status(403);
      res.send('Unknown subscription id');
      return;
    }
    await checkAndRefreshAccessToken(user);
    await onReceiveNotification(subscription, user);
  } catch (e) {
    console.error(e);
  }

  res.status(200);
  res.json({
    result: 'OK',
  });
}


async function interactiveMessages(req, res) {
  // Shared secret can be found on RingCentral developer portal, under your app Settings
  const SHARED_SECRET = process.env.IM_SHARED_SECRET;
  if (SHARED_SECRET) {
    const signature = req.get('X-Glip-Signature', 'sha1=');
    const encryptedBody =
      crypto.createHmac('sha1', SHARED_SECRET).update(JSON.stringify(req.body)).digest('hex');
    if (encryptedBody !== signature) {
      res.status(401).send();
      return;
    }
  }
  const body = req.body;
  console.log(`Incoming interactive message: ${JSON.stringify(body, null, 2)}`);
  if (!body.data || !body.user || !body.data.groupId || !body.data.botId) {
    res.status(400);
    res.send('Params error');
    return;
  }
  const { botId, groupId } = body.data;
  const bot = await Bot.findByPk(botId);
  if (!bot) {
    console.error(`Bot not found with id: ${botId}`);
    res.status(400);
    res.send('Bot not found');
    return;
  }

  switch (body.data.actionType) {
    case 'auth':
      const oauthApp = getOAuthApp();
      const authorizeUrl = `${oauthApp.code.getUri({
        state: `botId=${botId}&groupId=${groupId}&rcUserId=${body.user.accountId}`
      })}&access_type=offline`;
      await bot.sendMessage(groupId, { text: `![:Person](${body.user.accountId}), please click link to authorize: ${authorizeUrl}` });
      res.status(200);
      res.send('OK');
      return;
  }

  const user = await GoogleUser.findOne({
    where: {
      rcUserId: body.user.accountId
    }
  });


  if (!user) {
    res.status(403);
    console.log(`Unknown user id: ${body.data.userId}`);
    res.send('Unknown user id');
    return;
  }
  const subscriptionId = req.body.data.subscriptionId;
  const subscription = user.subscriptions.find(s => s.id == subscriptionId);
  if (!subscription) {
    res.status(403);
    console.log(`Unknown subscription id: ${subscriptionId}`);
    res.send('Unknown subscription id');
    return;
  }
  const oauth = getOAuthApp();
  const action = body.data.action;
  if (action === 'authorize') {
  }
  // if the action is not 'authorize', then it needs to make sure that authorization is valid for this user
  else {
    await checkAndRefreshAccessToken(user);
    // If an unknown user wants to perform actions, we want to authenticate and authorize first
    if (!user || !user.accessToken) {
      await bot.sendAdaptiveCardMessage(
        subscription.rcWebhookUri,
        authCardTemplate,
        {
          authorizeUrl: oauth.code.getUri(),
          subscriptionId,
        });
      res.status(200);
      res.send('OK');
      return;
    }
  }

  // Call 3rd party API to perform action that you want to apply
  try {
    await onReceiveInteractiveMessage(req.body.data, user, subscription);
  } catch (e) {
    // Case: require auth
    if (e.statusCode === 401) {
      await bot.sendAdaptiveCardMessage(
        subscription.rcWebhookUri,
        authCardTemplate,
        {
          authorizeUrl: oauth.code.getUri(),
          subscriptionId,
        });
    }
    console.error(e);
  }
  res.status(200);
  res.json('OK');
}

exports.notification = notification;
exports.interactiveMessages = interactiveMessages;