const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
// Note: Google User comes with a global subscription for events which is documented here: https://developers.google.com/drive/api/v3/reference/changes/watch
exports.GoogleUser = sequelize.define('google-users', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  email: {
    type: Sequelize.STRING,
  },
  name: {
    type: Sequelize.STRING,
  },
  botId: {
    type: Sequelize.STRING,
  },
  rcUserId: {
    type: Sequelize.STRING,
  },
  rcDMGroupId: {
    type: Sequelize.STRING,
  },
  googleSubscriptionId: {
    type: Sequelize.STRING,
  },
  googleResourceId: {
    type: Sequelize.STRING,
  },
  startPageToken: {
    type: Sequelize.STRING,
  },
  refreshToken: {
    type: Sequelize.STRING,
  },
  accessToken: {
    type: Sequelize.STRING,
  },
  tokenExpiredAt: {
    type: Sequelize.DATE
  },
  isReceiveNewFile: {
    type: Sequelize.BOOLEAN
  }
});
