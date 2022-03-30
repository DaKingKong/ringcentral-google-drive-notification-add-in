const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { GoogleUser } = require('../src/server/models/googleUserModel');
const { GoogleFile } = require('../src/server/models/googleFileModel');
const { Subscription } = require('../src/server/models/subscriptionModel');
const { botHandler } = require('../src/server/handlers/botHandler');
const authorizationHandler = require('../src/server/handlers/authorizationHandler')
const rcAPI = require('../src/server/lib/rcAPI');
const nock = require('nock');

const eventDataTables = require('./testData/botHandlerData.json');
const groupId = 'groupId';
const botId = 'botId';
const subId = 'subId';
const fileId = 'fileId';
const googleUserId = 'googleUserId';
const rcUserId = 'rcUserId';

let requestBody = null;
const postScope = nock(process.env.RINGCENTRAL_SERVER)
    .persist()
    .post(`/restapi/v1.0/glip/groups/${groupId}/posts`)
    .reply(200, 'OK');
const cardScope = nock(process.env.RINGCENTRAL_SERVER)
    .persist()
    .post(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`)
    .reply(200, 'OK');

beforeAll(async () => {
    rcAPI.createConversation = jest.fn().mockReturnValue({ id: groupId });
    authorizationHandler.getInGroupRcUserGoogleAccountInfo = jest.fn().mockReturnValue({
        rcUserIdsWithoutGoogleAccount: [],
        rcUserIdsWithGoogleAccount: []
    });

    await Bot.create({
        id: botId,
        token: {
            access_token: 'accessToken'
        }
    })
    await GoogleUser.create({
        id: googleUserId,
        rcUserId,
        email: 'googleEmail'
    });
    await Subscription.create({
        subId,
        botId,
        groupId,
        fileId,
        state: 'realtime'
    })
    await GoogleFile.create({
        id: fileId,
        name: 'fileName',
        iconLink: '',
        ownerEmail: '',
        url: ''
    })
});

afterAll(async () => {
    await Bot.destroy({
        where: {
            id: botId
        }
    });
    await GoogleUser.destroy({
        where: {
            id: googleUserId
        }
    });
    await Subscription.destroy({
        where: {
            id: subId
        }
    });
    await GoogleFile.destroy({
        where: {
            id: fileId
        }
    });
    postScope.done();
    cardScope.done();
})

describe('botHandler', () => {

    test.each(eventDataTables.botJoinGroupCases)('bot join group', async eventData => {
        // Arrange
        let event = eventData.input.event;
        const bot = await Bot.findByPk(event.bot.id);
        event.bot = bot;
        postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });

        // Act
        await botHandler(event);

        // Assert
        expect(requestBody.text).not.toBeNull();
    });

    test.each(eventDataTables.missingGoogleAccountCases)('missing Google Account', async eventData => {
        // Arrange
        let event = eventData.input.event;
        const bot = await Bot.findByPk(event.bot.id);
        event.bot = bot;
        postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });

        // Act
        await botHandler(event);

        // Assert
        expect(requestBody.text).toBe(eventData.result);
    });

    test.each(eventDataTables.successfulCommandReturnMessage)('successful commands return message', async eventData => {
        // Arrange
        let event = eventData.input.event;
        const bot = await Bot.findByPk(event.bot.id);
        event.bot = bot;
        postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });

        // Act
        await botHandler(event);

        // Assert
        expect(requestBody.text).toBe(eventData.result);
    });

    test.each(eventDataTables.successfulCommandReturnCard)('successful commands return card', async eventData => {
        // Arrange
        let event = eventData.input.event;
        const bot = await Bot.findByPk(event.bot.id);
        event.bot = bot;
        cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });

        // Act
        await botHandler(event);

        // Assert
        expect(requestBody.type).toBe('AdaptiveCard');
    });

    test.each(eventDataTables.fileLinkPost)('file link return card', async eventData => {
        // Arrange
        let event = eventData.input.event;
        const bot = await Bot.findByPk(event.bot.id);
        event.bot = bot;
        authorizationHandler.checkUserFileAccess = jest.fn().mockReturnValue(true);
        authorizationHandler.getInGroupRcUserGoogleAccountInfo = jest.fn().mockReturnValue({
            rcUserIdsWithoutGoogleAccount: [],
            rcUserIdsWithGoogleAccount: [rcUserId]
        });
        cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });
        // Act
        await botHandler(event);

        // Assert
        expect(requestBody.type).toBe('AdaptiveCard');
    });
})