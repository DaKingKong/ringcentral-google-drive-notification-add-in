require('dotenv').config();
const axios = require('axios');
const { User } = require('./server/models/userModel');
const { onSubscribe, onUnsubscribe } = require('./server/handlers/subscriptionHandler');
// Google Drive notification subscription expiry is default to 24 hours.
// This cron job is to refresh all Google Drive subscriptions every 12 hours.
async function refreshSubscription() {
    try {
        let successMessage = 'Google Drive Notification Subscription\n';
        const users = await User.findAll();
        for (const user of users) {
            console.log(`refreshing subscriptions for user: ${user.id}...`);
            successMessage += `User: ${user.name}(${user.email}) refreshed:\n`;
            const rcWebhookUris = user.subscriptions.map(s => s.rcWebhookUri);
            for (const rcWebhookUri of rcWebhookUris) {
                console.log(`unsubscribing webhookUri: ${rcWebhookUri}`);
                const unSubscriptionId = await onUnsubscribe(user, rcWebhookUri);
                const subscriptionId = await onSubscribe(user, rcWebhookUri);
                successMessage += `  ${unSubscriptionId} => ${subscriptionId}\n`;
            }
        }
        axios.post(
            'https://hooks.ringcentral.com/webhook/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6InUiLCJvaSI6IjE0MDU1MDk2NDgzODciLCJpZCI6IjEzNzg3NTQ1ODcifQ.Nq6z0NWegffNJWZdPIOjePFfCUCgK3bBCk4Z3SDY_hY',
            {
                "title": successMessage
            }
        );
    }
    catch (e) {
        axios.post(
            'https://hooks.ringcentral.com/webhook/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvdCI6InUiLCJvaSI6IjE0MDU1MDk2NDgzODciLCJpZCI6IjEzNzg3NTQ1ODcifQ.Nq6z0NWegffNJWZdPIOjePFfCUCgK3bBCk4Z3SDY_hY',
            {
                "title": `refresh subscription error: ${e.message}`
            }
        );
    }
}

// Commented out for local testing
// refreshSubscription()

exports.app = refreshSubscription;