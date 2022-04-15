const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { GoogleFile } = require('../src/server/models/googleFileModel');
const { GoogleUser } = require('../src/server/models/googleUserModel');
const { Subscription } = require('../src/server/models/subscriptionModel');
const { RcUser } = require('../src/server/models/rcUserModel');

jest.setTimeout(30000);

beforeAll(async () => {
  await Bot.sync();
  await GoogleFile.sync();
  await GoogleUser.sync();
  await Subscription.sync();
  await RcUser.sync();
});
