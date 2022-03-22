const request = require('supertest');
const authorizationHandler = require('../src/server/handlers/authorizationHandler');
const rcAPI = require('../src/server/lib/rcAPI');
const { server } = require('../src/server.js');
const { GoogleUser } = require('../src/server/models/googleUserModel')
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');

const groupId = 'groupId';
const accessToken = 'accessToken';
const botId = 'botId';

const botUserInfo = {
    id: 'botUserId',
    email: 'test@test.bot.glip.net'
}

const userInfo1 = {
    id: 'rcUserId1',
    email: 'test1@email'
}
const userInfo2 = {
    id: 'rcUserId2',
    email: 'test2@email'
}

beforeAll(async () => {
    await GoogleUser.create({
        id: 'googleUserId',
        rcUserId: 'rcUserId1'
    });
    await Bot.create({
        id: botId
    })
});

afterAll(async () => {
    await GoogleUser.destroy({
        where: {
            id: 'googleUserId'
        }
    });
})

// Global arrange
rcAPI.getGroupInfo = jest.fn().mockReturnValue({ members: [] });

// Example tests
describe('authorizationHandler - getInGroupRcUserGoogleAccountInfo', () => {
    test('1 bot + 1 user without google account', async () => {
        // Arrange
        rcAPI.getBulkUserInfo = jest.fn().mockReturnValue([botUserInfo, userInfo2]);

        // Act
        const inGroupUserInfo = await authorizationHandler.getInGroupRcUserGoogleAccountInfo(groupId, accessToken);

        // Assert
        expect(inGroupUserInfo.rcUserIdsWithGoogleAccount.length).toBe(0);
        expect(inGroupUserInfo.rcUserIdsWithoutGoogleAccount.length).toBe(1);
    });

    test('1 bot + 1 user with google account + 1 user without google account', async () => {
        // Arrange
        rcAPI.getBulkUserInfo = jest.fn().mockReturnValue([botUserInfo, userInfo1, userInfo2]);

        // Act
        const inGroupUserInfo = await authorizationHandler.getInGroupRcUserGoogleAccountInfo(groupId, accessToken);

        // Assert
        expect(inGroupUserInfo.rcUserIdsWithGoogleAccount.length).toBe(1);
        expect(inGroupUserInfo.rcUserIdsWithoutGoogleAccount.length).toBe(1);
        expect(inGroupUserInfo.rcUserIdsWithGoogleAccount[0]).toBe('rcUserId1');
        expect(inGroupUserInfo.rcUserIdsWithoutGoogleAccount[0]).toBe('rcUserId2');
    });
});

describe('authorizationHandler - oauthCallback', async () => {
    test('botId missing', async () => {
        // Arrange
        const unknownBotId = 'unknownBotId';

        // Act

        // Assert
        await request(server).get(`/oauth-callback?state=botId=${unknownBotId}&rcUserId=rcUserId`)
            .expect(404);
    });
})