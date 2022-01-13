const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
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
  rcUserId: {
    type: Sequelize.STRING,
  },
  refreshToken: {
    type: Sequelize.STRING,
  },
  accessToken: {
    type: Sequelize.STRING,
  },
  tokenExpiredAt:{
    type: Sequelize.DATE
  }
});
