const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for Google File data
exports.RcUser = sequelize.define('rc-users', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  authReminderExpiryDateTime: {
    type: Sequelize.DATE,
  }
});
