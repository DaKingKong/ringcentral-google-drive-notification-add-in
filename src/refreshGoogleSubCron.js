require('dotenv').config();
const axios = require('axios');
const { GoogleUser } = require('./server/models/googleUserModel');
const subscriptionHandler = require('./server/handlers/subscriptionHandler');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { getOAuthApp } = require('./server/lib/oauth');
const cardBuilder = require('./server/lib/cardBuilder');
// Google Drive notification subscription expiry is default to 24 hours.
// This cron job is to refresh all Google Drive subscriptions every 12 hours.
async function refreshSubscription() {
    console.log('start refreshing...');
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
            // If there's an authorization error, we want to remind user that the current token
            // is invalid and we've delete it. We then send a once-time login card for them to 
            // login again if wanted
            if(e.message == 'Invalid Credentials')
            {
                const bot = await Bot.findByPk(googleUser.botId);
                const rcDMGroupId = googleUser.rcDMGroupId;
                const rcUserId = googleUser.rcUserId;
                await googleUser.destroy();
                await bot.sendMessage(rcDMGroupId, { text: 'Failed to refresh Google Drive subscription. It could be that the token was revoked or issued to another client. Please login again to restore functionalities.\n\nPlease submit feedback with your email if you require further supports, thanks!' });
                const oauthApp = getOAuthApp();
                const authLink = `${oauthApp.code.getUri({
                    state: `botId=${bot.id}&rcUserId=${rcUserId}`
                })}&access_type=offline`;
                const authCard = cardBuilder.authCard(authLink, 'This card is generated from Google Account authorization error and will only be generated once.'); 
                await bot.sendAdaptiveCard(rcDMGroupId, authCard);
            }
        }
    }
    console.log(successMessage);
}

// Commented out. It's for local testing
// refreshSubscription()

exports.app = refreshSubscription;