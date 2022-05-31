const { GoogleUser } = require('../models/googleUserModel');
const { Subscription } = require('..//models/subscriptionModel');
const { RcUser } = require('../models/rcUserModel');

const subscriptionHandler = require('../handlers/subscriptionHandler');

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
        const resultData = googleUsers.map(g => { return { email: g.email, botId: g.botId, isReceiveNewFile: g.isReceiveNewFile, googleSubscriptionId: g.googleSubscriptionId, tokenExpiredAt: g.tokenExpiredAt } });
        res.status(200);
        res.json(resultData);
    }
    else {
        res.status(401);
        res.send('Auth failed.');
    }
    return;
}

async function removeGoogleUserByEmail(req, res){
    const basicAuth = req.headers.authorization.split('Basic ')[1];
    if (basicAuth == basicAuthString) {
        const googleUser = await GoogleUser.findOne({
            where:{
                email: req.query.email
            }
        });
        const rcUser = await RcUser.findByPk(googleUser.rcUserId);
        if(rcUser)
        {
            await rcUser.destroy();
        }
        if(googleUser)
        {
            await subscriptionHandler.stopSubscriptionForUser(googleUser);
            await googleUser.destroy();
        }
        res.status(200);
        res.send('User and Subscriptions removed.');
    }
    else {
        res.status(401);
        res.send('Auth failed.');
    }
    return;
}

exports.getSubscriptionCount = getSubscriptionCount;
exports.getGoogleUserList = getGoogleUserList;
exports.removeGoogleUserByEmail = removeGoogleUserByEmail;