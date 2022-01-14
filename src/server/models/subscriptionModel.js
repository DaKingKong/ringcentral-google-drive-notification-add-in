const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
exports.Subscription = sequelize.define('subscriptions', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  googleSubscriptionId: {
    type: Sequelize.STRING,
  },
  googleResourceId: {
    type: Sequelize.STRING,
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
  startPageToken: {
    type: Sequelize.STRING,
  },
  subscriptions:{
    type: Sequelize.JSON
  }
});
