require('dotenv').config();
const { User } = require('../src/server/models/userModel');

async function initDB() {
  await User.sync();
}

initDB();
