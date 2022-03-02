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
  rcUserId: {
    type: Sequelize.STRING,
  },
  rcUserName: {
    type: Sequelize.STRING,
  },
  googleUserId: {
    type: Sequelize.STRING,
  },
  fileId: {
    type: Sequelize.STRING,
  },
  // realtime, daily, weekly, muted
  state: {
    type: Sequelize.STRING,
  },
  stateBeforeMuted: {
    type: Sequelize.STRING,
  },
  startTime: {
    type: Sequelize.DATE,
  },
  // cachedInfo = commentNotifications
  cachedInfo:{
    type: Sequelize.JSON
  }
});
