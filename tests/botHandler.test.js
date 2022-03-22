const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { botHandler } = require('../src/server/handlers/botHandler');
const rcAPI = require('../src/server/lib/rcAPI');
const nock = require('nock');

const groupId = 'groupId';
const botId = 'botId';
const eventDataTable = [
    {
        text: 'logout',
        userId: 'unknownId'
    },
    {
        text: 'sub',
        userId: 'unknownId'
    },
    {
        text: 'subscribe',
        userId: 'unknownId'
    },
    {
        text: 'config',
        userId: 'unknownId'
    },
    {
        text: 'list',
        userId: 'unknownId'
    }
]

beforeAll(async () => {
    await Bot.create({
        id: botId,
        token:{
            access_token: 'accessToken'
        }
    })
});

describe('botHandler', () => {
    test.each(eventDataTable)('missing Google Account', async eventData => {
        // Arrange
        const bot = await Bot.findByPk(botId);
        
        const event = {
            type: 'Message4Bot',
            text: eventData.text,
            userId: eventData.userId,
            bot,
            group:{
                id: groupId
            }
        }

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
        expect(requestBody.text).toBe('Google Drive account not found. Please type `login` to authorize your account.');

        // Clean up
        scope.done();
    });
})