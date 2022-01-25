const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
// Note: Subscription is co-identified by groupId and googleUserId and manages one file 
exports.Subscription = sequelize.define('subscriptions', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  groupId: {
    type: Sequelize.STRING,
  },
  botId: {
    type: Sequelize.STRING,
  },
  googleUserId: {
    type: Sequelize.STRING,
  },
  fileId: {
    type: Sequelize.STRING,
  },
  isEnabled: {
    type: Sequelize.BOOLEAN
  }
});
