const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for Google File data
exports.GoogleFile = sequelize.define('google-files', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  name: {
    type: Sequelize.STRING,
  },
  iconLink: {
    type: Sequelize.STRING,
  },
  ownerEmail: {
    type: Sequelize.STRING,
  },
  url: {
    type: Sequelize.STRING,
  }
});
