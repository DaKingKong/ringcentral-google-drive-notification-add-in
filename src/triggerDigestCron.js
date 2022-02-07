require('dotenv').config();
const moment = require('moment');
const { Subscription } = require('./server/models/subscriptionModel');
const { SendDigestNotification } = require('./server/handlers/notificationHandler');
async function triggerDigest() {
    try {
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
        for (const sub in subscriptionsToTrigger) {
            if (sub.cachedInfo.commentNotifications.length === 0) {
                continue;
            }
            await SendDigestNotification(sub);
            await sub.update({
                cachedInfo: {
                    commentNotifications: []
                }
            });
        }
    }
    catch (e) {
        console.log(e.message);
    }
}

// Commented out for local testing
// triggerDigest()

exports.app = triggerDigest;