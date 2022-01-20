const express = require('express');
const { extendApp } = require('ringcentral-chatbot-core');

const { botHandler } = require('./handlers/botHandler');
const authorizationHandler = require('./handlers/authorizationHandler');
const notificationHandler = require('./handlers/notificationHandler');
const interactiveMessageHandler = require('./handlers/interactiveMessageHandler');

const { GoogleUser } = require('./models/googleUserModel');
const { Subscription } = require('./models/subscriptionModel');

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

  extendApp(app, skills, botHandler, botConfig);
  app.listen(process.env.RINGCENTRAL_CHATBOT_EXPRESS_PORT);

  console.log('server running...');
  console.log(`bot oauth uri: ${process.env.RINGCENTRAL_CHATBOT_SERVER}${botConfig.botRoute}/oauth`);

  app.get('/oauth-callback', authorizationHandler.oauthCallback);
  app.post('/notification', notificationHandler.notification);
  app.post('/interactive-messages', interactiveMessageHandler.interactiveMessages);

  // google domain verification html
  app.use('/', express.static(__dirname + '/html'));
}
