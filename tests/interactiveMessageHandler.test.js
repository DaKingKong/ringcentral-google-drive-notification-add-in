const request = require('supertest');
const authorizationHandler = require('../src/server/handlers/authorizationHandler');
const rcAPI = require('../src/server/lib/rcAPI');
const { server } = require('../src/server.js');
const { GoogleUser } = require('../src/server/models/googleUserModel')
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const testData = require('./testData/interactiveMessageData.json');
const nock = require('nock');

const groupId = 'groupId';
const accessToken = 'accessToken';
const botId = 'botId';
const rcUserId = 'rcUserId';
const googleUserId = 'googleUserId';
const googleUserEmail = 'googleUserEmail';

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
    await GoogleUser.create({
        id: googleUserId,
        rcUserId,
        email: googleUserEmail
    });
    await Bot.create({
        id: botId,
        token:{
            access_token: accessToken
        }
    })
});

afterAll(async () => {
    await GoogleUser.destroy({
        where: {
            id: googleUserId
        }
    });
    await Bot.destroy({
        where: {
            id: botId
        }
    });
    postScope.done();
    cardScope.done();
})

// Global arrange
rcAPI.getGroupInfo = jest.fn().mockReturnValue({ members: [] });

describe('interactiveMessageHandler - validations', () => {
    test.each(testData.serverValidations)('server error code', async data => {
        // Arrange
        const payload = data.body;

        // Act
        // Assert
        await request(server).post(`/interactive-messages`).send(payload)
            .expect(400);
    });
    test.each(testData.botMessageValidations)('bot error message', async data => {
        // Arrange
        const payload = data.body;
        postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });

        // Act
        // Assert
        await request(server).post(`/interactive-messages`).send(payload)
            .expect(200);
        expect(requestBody.text).toBe(data.result);
    });
    test.each(testData.simpleCardGeneration)('simple card generation', async data => {
        // Arrange
        const payload = data.body;
        cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
            requestBody = JSON.parse(reqBody);
        });

        // Act
        // Assert
        await request(server).post(`/interactive-messages`).send(payload)
            .expect(200);
        expect(requestBody.type).toBe('AdaptiveCard');
    });
})