require('dotenv').config();
const axios = require('axios');
const { GoogleUser } = require('./server/models/googleUserModel');
const subscriptionHandler = require('./server/handlers/subscriptionHandler');
// Google Drive notification subscription expiry is default to 24 hours.
// This cron job is to refresh all Google Drive subscriptions every 12 hours.
async function refreshSubscription() {
    let successMessage = 'Google Drive Notification Subscription\n';
    const googleUsers = await GoogleUser.findAll();
    for (const googleUser of googleUsers) {
        try {
            console.log(`refreshing subscriptions for user: ${googleUser.email}...`);
            await subscriptionHandler.refreshSubscriptionForUser(googleUser);
        }
        catch (e) {
            console.log(e.message);
            await axios.post(
                'https://hooks.ringcentral.com/webhook/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6InUiLCJvaSI6IjE0MDU1MDk2NDgzODciLCJpZCI6IjEzNzg3NTQ1ODcifQ.Nq6z0NWegffNJWZdPIOjePFfCUCgK3bBCk4Z3SDY_hY',
                {
                    "title": `refresh subscription error for ${googleUser.email}\nError: ${e.message}`
                }
            );
        }
    }
    console.log(successMessage);
}

// Commented out. It's for local testing
// refreshSubscription()

exports.app = refreshSubscription;