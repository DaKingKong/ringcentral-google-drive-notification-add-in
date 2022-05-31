const path = require('path');
const { extendApp } = require('ringcentral-chatbot-core');

const { botHandler } = require('./handlers/botHandler');
const authorizationHandler = require('./handlers/authorizationHandler');
const notificationHandler = require('./handlers/notificationHandler');
const interactiveMessageHandler = require('./handlers/interactiveMessageHandler');
const dbAccessHandler = require('./handlers/dbAccessHandler');

const { GoogleUser } = require('./models/googleUserModel');
const { GoogleFile } = require('./models/googleFileModel');
const { Subscription } = require('./models/subscriptionModel');
const { RcUser } = require('./models/rcUserModel');

// extends or override express app as you need
exports.appExtend = (app) => {
  const skills = [];
  const botConfig = {
    adminRoute: '/admin', // optional
    botRoute: '/bot', // optional
    models: { // optional
      GoogleUser,
      GoogleFile,
      Subscription,
      RcUser
    }
  }

  extendApp(app, skills, botHandler, botConfig);
  
  if (process.env.NODE_ENV !== 'test') {
    app.listen(process.env.RINGCENTRAL_CHATBOT_EXPRESS_PORT);
  }

  app.get('/is-alive', (req, res) => { res.send('OK'); });

  console.log('server running...');
  console.log(`bot oauth uri: ${process.env.RINGCENTRAL_CHATBOT_SERVER}${botConfig.botRoute}/oauth`);

  app.get('/oauth-callback', authorizationHandler.oauthCallback);
  app.post('/notification', notificationHandler.notification);
  app.post('/interactive-messages', interactiveMessageHandler.interactiveMessages);
  app.get('/db/subCount', dbAccessHandler.getSubscriptionCount);
  app.get('/db/googleUser', dbAccessHandler.getGoogleUserList);
  app.delete('/db/removeUserByEmail', dbAccessHandler.removeGoogleUserByEmail);

  // host home page
  app.get('/home', function (req, res) {
    res.sendFile(path.join(__dirname, 'html/index.html'));
  });
}
