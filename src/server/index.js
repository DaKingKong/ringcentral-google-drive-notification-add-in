const express = require('express');
const { extendApp } = require('ringcentral-chatbot-core');

const authorizationHandler = require('./handlers/authorizationHandler');
const subscriptionHandler = require('./handlers/subscriptionHandler');
const notificationHandler = require('./handlers/notificationHandler');
const notificationRoute = require('./routes/notification');

const { GoogleUser } = require('./models/googleUserModel');
const { Subscription } = require('./models/subscriptionModel');
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');

// extends or override express app as you need
exports.appExtend = (app) => {
  const skills = [];
  const botConfig = {
    adminRoute: '/admin', // optional
    botRoute: '/bot', // optional
    models: { // optional
      GoogleUser,
      Subscription
    }
  }

  // handle bot commands
  const botHandler = async event => {
    try {
      switch (event.type) {
        case 'Message4Bot':
          const { text: cmdText, group: cmdGroup, bot: botForMessage } = event;
          console.log('=====event.Message4Bot=====');
          console.log(`=====incomingCommand.Message4Bot.${cmdText}=====`);
          switch (cmdText) {
            case 'hello':
              await botForMessage.sendMessage(cmdGroup.id, { text: 'hello' });
              break;
            case 'auth':
              const userIdsWithoutGoogleAccount = await authorizationHandler.getUsersWithoutGoogleAccount(cmdGroup.id, botForMessage.token.access_token);
              let mentionMessage = 'Please use below card button to authorize your Google Account. '
              for (const userId of userIdsWithoutGoogleAccount) {
                mentionMessage += `![:Person](${userId}) `;
              }
              await botForMessage.sendMessage(cmdGroup.id, { text: mentionMessage });
              const authCard = authorizationHandler.getAuthCard(botForMessage.id, cmdGroup.id);
              await botForMessage.sendAdaptiveCard(cmdGroup.id, authCard);
              break;
          }
          break;
        case 'PostAdded':
          const { text: postText, groupId: postGroupId, creatorId } = event.message.body;
          console.log(`=====event.PostAdded=====${JSON.stringify(event)}`);
          if (postText) {
            const googleFileLinkRegex = new RegExp('https://drive.google.com/file/d/.+?/view\\?usp=sharing', 'g');
            const matches = postText.matchAll(googleFileLinkRegex);
            // Jupiter converts links to [{link}](link) format...so we'd have at least 2 occurrences for 1 link input
            const distinctMatches = [];
            for (const match of matches) {
              if (!distinctMatches.includes(match[0])) {
                distinctMatches.push(match[0]);
              }
            }

            if (distinctMatches.length === 0) {
              break;
            }

            const botForPost = await Bot.findByPk(event.message.ownerId);

            // if any Google file link detected, check if this GoogleUser exists
            const googleUser = await GoogleUser.findOne({
              where: {
                rcUserId: creatorId
              }
            });

            // if rc user has NO authorized Google Account, send an auth card
            if (!googleUser) {
              await botForPost.sendMessage(postGroupId, { text: `Google Drive file link detected. But post owner ![:Person](${creatorId}) doesn't have an authorized Google Account. Please authorize by clicking button below and then post link(s) again.` });
              const authCard = authorizationHandler.getAuthCard(botForPost.id, postGroupId);
              await botForPost.sendAdaptiveCard(postGroupId, authCard);
              break;
            }

            // if rc user has Google Account, subscribe to all files in links
            const fileIdRegex = new RegExp('https://drive.google.com/file/d/(.*)/view\\?usp=sharing');
            for (const match of distinctMatches) {
              // Subscribe to the file - Note: Google file share link is https://drive.google.com/file/d/{fileId}/view\\?usp=sharing
              const fileId = match.match(fileIdRegex)[1];
              await subscriptionHandler.onSubscribe(googleUser, postGroupId, botForPost.id, fileId);
            }
            await botForPost.sendMessage(postGroupId, { text: `Google Drive file link(s) detected and subscription(s) added for File Comment events.` });
          }
          break;
      }
    }
    catch (e) {
      console.log(e);
    }
  }

  extendApp(app, skills, botHandler, botConfig);
  app.listen(process.env.RINGCENTRAL_CHATBOT_EXPRESS_PORT);

  console.log('server running...');
  console.log(`bot oauth uri: ${process.env.RINGCENTRAL_CHATBOT_SERVER}${botConfig.botRoute}/oauth`);

  //oauth
  app.get('/oauth-callback', authorizationHandler.oauthCallback);

  // notification
  app.post('/notification', notificationHandler.notification);
  app.post('/interactive-messages', notificationRoute.interactiveMessages);

  // google domain verification html
  app.use('/', express.static(__dirname + '/html'));

  // configure
  // app.post(constants.route.forClient.SUBSCRIBE, subscriptionRoute.subscribe);
  // app.post(constants.route.forClient.UNSUBSCRIBE, subscriptionRoute.unsubscribe);
}
