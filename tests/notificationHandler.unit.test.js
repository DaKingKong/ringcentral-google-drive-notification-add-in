const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { Subscription } = require('../src/server/models/subscriptionModel');
const nock = require('nock');
const notificationHandler = require('../src/server/handlers/notificationHandler');

const subId = 'subId';
const botId = 'botId';
const accessToken = 'accessToken';
const groupId = 'groupId';

const cardScope = nock(process.env.RINGCENTRAL_SERVER)
    .persist()
    .post(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`)
    .reply(200, 'OK');

beforeAll(async () => {
    await Bot.create({
        id: botId,
        token: {
            access_token: accessToken
        }
    })
});

afterAll(async () => {
    await Bot.destroy({
        where: {
            id: botId
        }
    });
    cardScope.done();
})

describe('notificationHandler', () => {
    test('no sub - nothing', async () => {
        // Arrange
        const subscriptions = [];

        // Act
        await notificationHandler.SendDigestNotification(subscriptions);

        // Assert
    });

    test('has sub, no cached notification - nothing', async () => {
        // Arrange
        const sub = await Subscription.create({
            botId,
            groupId,
            cachedInfo: {
                commentNotifications: []
            }
        });
        const subscriptions = [sub];
        // Act
        await notificationHandler.SendDigestNotification(subscriptions);

        // Assert

        // Clean up
        await sub.destroy();
    });

    test('has 1 sub, has 1 notification - 1 notification card', async () => {
        // Arrange
        let requestBody = null;
        const sub = await Subscription.create({
            id: subId,
            botId,
            groupId,
            cachedInfo: {
                commentNotifications: [
                    {
                        userAvatar: 'https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png',
                        username: '',
                        userEmail: '',
                        fileIconUrl: '',
                        fileName: 'fileName',
                        commentContent: '',
                        quotedContent: '',
                        fileUrl: '',
                        commentIconUrl: 'https://lh3.googleusercontent.com/UeyfqNkFySLGNweD_KkSUPrMoUekF17KLqeWi18L2UwZZZrEbVl8vNledRTp2iRqJUE=w36',
                        userId: 'googleUserId',
                        subscriptionId: subId,
                        commentId: undefined,
                        fileId: 'fileId',
                        botId
                    }
                ]
            }
        });
        const subscriptions = [sub];
        cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });
        // Act
        await notificationHandler.SendDigestNotification(subscriptions);

        // Assert
        const updatedSub = await Subscription.findByPk(subId);
        expect(updatedSub.cachedInfo.commentNotifications.length).toBe(0);
        expect(requestBody.type).toBe('AdaptiveCard');
        expect(requestBody.body[0].text).toBe('New Notifications');

        // Clean up
        await sub.destroy();
    });

    test('has 2 sub in 2 groups, has 1 notification for each - 1 notification card for each group', async () => {
        // Arrange
        let cardRequestBody1 = null;
        let cardRequestBody2 = null;
        const sub1 = await Subscription.create({
            id: subId,
            botId,
            groupId,
            cachedInfo: {
                commentNotifications: [
                    {
                        userAvatar: 'https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png',
                        username: '',
                        userEmail: '',
                        fileIconUrl: '',
                        fileName: 'fileName',
                        commentContent: '',
                        quotedContent: '',
                        fileUrl: '',
                        commentIconUrl: 'https://lh3.googleusercontent.com/UeyfqNkFySLGNweD_KkSUPrMoUekF17KLqeWi18L2UwZZZrEbVl8vNledRTp2iRqJUE=w36',
                        userId: 'googleUserId',
                        subscriptionId: subId,
                        commentId: undefined,
                        fileId: 'fileId',
                        botId
                    }
                ]
            }
        });
        const sub2 = await Subscription.create({
            id: 'subId2',
            botId,
            groupId: 'groupId2',
            cachedInfo: {
                commentNotifications: [
                    {
                        userAvatar: 'https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png',
                        username: '',
                        userEmail: '',
                        fileIconUrl: '',
                        fileName: 'fileName',
                        commentContent: '',
                        quotedContent: '',
                        fileUrl: '',
                        commentIconUrl: 'https://lh3.googleusercontent.com/UeyfqNkFySLGNweD_KkSUPrMoUekF17KLqeWi18L2UwZZZrEbVl8vNledRTp2iRqJUE=w36',
                        userId: 'googleUserId',
                        subscriptionId: 'subId2',
                        commentId: undefined,
                        fileId: 'fileId',
                        botId
                    }
                ]
            }
        });
        const subscriptions = [sub1, sub2];


        const cardScope2 = nock(process.env.RINGCENTRAL_SERVER)
            .persist()
            .post(`/restapi/v1.0/glip/chats/groupId2/adaptive-cards`)
            .reply(200, 'OK');
        cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            cardRequestBody1 = JSON.parse(reqBody);
        });
        cardScope2.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            cardRequestBody2 = JSON.parse(reqBody);
        });

        // Act
        await notificationHandler.SendDigestNotification(subscriptions);

        // Assert
        const updatedSub1 = await Subscription.findByPk(subId);
        const updatedSub2 = await Subscription.findByPk('subId2');
        expect(updatedSub1.cachedInfo.commentNotifications.length).toBe(0);
        expect(updatedSub2.cachedInfo.commentNotifications.length).toBe(0);
        expect(cardRequestBody1.type).toBe('AdaptiveCard');
        expect(cardRequestBody1.body[0].text).toBe('New Notifications');
        expect(cardRequestBody2.type).toBe('AdaptiveCard');
        expect(cardRequestBody2.body[0].text).toBe('New Notifications');

        // Clean up
        await sub1.destroy();
        await sub2.destroy();
        cardScope2.done();
    });
});