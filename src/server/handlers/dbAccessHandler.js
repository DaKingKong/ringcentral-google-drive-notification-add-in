const { GoogleUser } = require('../models/googleUserModel');
const { Subscription } = require('..//models/subscriptionModel');

const basicAuthString = Buffer.from(`${process.env.RINGCENTRAL_CHATBOT_ADMIN_USERNAME}:${process.env.RINGCENTRAL_CHATBOT_ADMIN_PASSWORD}`).toString('base64');

async function getSubscriptionCount(req, res) {
    const basicAuth = req.headers.authorization.split('Basic ')[1];
    if (basicAuth == basicAuthString) {
        const subscriptions = await Subscription.findAll();
        res.status(200);
        res.send(subscriptions.length.toString());
    }
    else {
        res.status(401);
        res.send('Auth failed.');
    }
    return;
}

async function getGoogleUserList(req, res) {
    const basicAuth = req.headers.authorization.split('Basic ')[1];
    if (basicAuth == basicAuthString) {
        const googleUsers = await GoogleUser.findAll();
        const resultData = googleUsers.map(g => { return { email: g.email, botId: g.botId, isReceiveNewFile: isReceiveNewFile } });
        res.status(200);
        res.json(resultData);
    }
    else {
        res.status(401);
        res.send('Auth failed.');
    }
    return;
}

exports.getSubscriptionCount = getSubscriptionCount;
exports.getGoogleUserList = getGoogleUserList;