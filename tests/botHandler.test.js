const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { botHandler } = require('../src/server/handlers/botHandler');
const rcAPI = require('../src/server/lib/rcAPI');
const nock = require('nock');

const eventDataTables = require('./testData/botHandlerData.json');
const groupId = 'groupId';
const botId = 'botId';

beforeAll(async () => {
    await Bot.create({
        id: botId,
        token:{
            access_token: 'accessToken'
        }
    })
});

afterAll(async () => {
    await Bot.destroy({
        where: {
            id: botId
        }
    });
})

describe('botHandler', () => {
    test.each(eventDataTables.botJoinGroupCases)('bot join group', async eventData => {
        // Arrange
        let event = eventData.input.event;
        const bot = await Bot.findByPk(event.bot.id);
        event.bot = bot;
        rcAPI.createConversation = jest.fn().mockReturnValue({ id: groupId });

        const scope = nock(process.env.RINGCENTRAL_SERVER)
            .post(`/restapi/v1.0/glip/groups/${groupId}/posts`)
            .reply(200, 'OK');
        let requestBody = null;
        scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });

        // Act
        await botHandler(event);

        // Assert
        expect(requestBody.text).not.toBeNull();

        // Clean up
        scope.done();
    });

    test.each(eventDataTables.missingGoogleAccountCases)('missing Google Account', async eventData => {
        // Arrange
        let event = eventData.input.event;
        const bot = await Bot.findByPk(event.bot.id);
        event.bot = bot;
        rcAPI.createConversation = jest.fn().mockReturnValue({ id: groupId });

        const scope = nock(process.env.RINGCENTRAL_SERVER)
            .post(`/restapi/v1.0/glip/groups/${groupId}/posts`)
            .reply(200, 'OK');
        let requestBody = null;
        scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });

        // Act
        await botHandler(event);

        // Assert
        expect(requestBody.text).toBe(eventData.result);

        // Clean up
        scope.done();
    });
})