require('dotenv').config();
const moment = require('moment');
const { Subscription } = require('./server/models/subscriptionModel');
const notificationHandler = require('./server/handlers/notificationHandler');
async function triggerDigest() {
    try {
        console.log('digest triggered...')
        const weeklySubscriptions = await Subscription.findAll({
            where: {
                state: 'weekly'
            }
        });
        const weeklySubscriptionsOnDay = weeklySubscriptions.filter(s => moment(new Date()).utc().day() - moment(s.startTime).utc().day() === 0);
        const dailySubscriptions = await Subscription.findAll({
            where: {
                state: 'daily'
            }
        });
        const subscriptionsOnDay = weeklySubscriptionsOnDay.concat(dailySubscriptions);
        const subscriptionsToTrigger = subscriptionsOnDay.filter(s => moment(new Date()).utc().hour() - moment(s.startTime).utc().hour() === 0);
        console.log(`digest count: ${subscriptionsToTrigger.length}`)
        notificationHandler.SendDigestNotification(subscriptionsToTrigger);
        return;
    }
    catch (e) {
        console.log(e.message);
    }
}

// Commented out. It's for local testing
// triggerDigest()

exports.app = triggerDigest;