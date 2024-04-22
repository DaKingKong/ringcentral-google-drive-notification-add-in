const request = require('supertest');
const rcAPI = require('../src/server/lib/rcAPI.js');
const { server } = require('../src/server.js');
const { GoogleUser } = require('../src/server/models/googleUserModel.js')
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { getOAuthApp } = require('../src/server/lib/oauth.js');
const nock = require('nock');
const mockAPIData = require('./testData/mockAPIData.json');

const groupId = 'groupId';
const accessToken = 'accessToken';
const rcUserId = 'rcUserId';
const refreshToken = 'refreshToken';
const expires = 'expires';
const botId = 'botId';
const googleUserId = 'googleUserId';
const googleUserEmail = 'googleUserEmail';

const postScope = nock(process.env.RINGCENTRAL_SERVER)
    .persist()
    .post(`/restapi/v1.0/glip/groups/${groupId}/posts`)
    .reply(200, 'OK');

beforeAll(async () => {
    rcAPI.createConversation = jest.fn().mockReturnValue(mockAPIData.rcAPI.createConversation.successfulCreation);
    await GoogleUser.create({
        id: googleUserId,
        rcUserId,
        email: googleUserEmail,
        rcDMGroupId: groupId
    });
    await Bot.create({
        id: botId,
        token: {
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
})

// Example tests
describe('oauthCallback', () => {
    describe('validations', () => {
        test('not botId - 404', async () => {
            // Arrange
            const callbackQueryString = 'state=rcUserId=rcUserId&code=authCode&scope=scope'

            // Act
            const res = await request(server).get(`/oauth-callback?${callbackQueryString}`);

            // Assert
            expect(res.status).toEqual(404);
            expect(res.text).toEqual('Bot not found');
        });

        test('not accessToken - 403', async () => {
            // Arrange
            getOAuthApp().code.getToken = jest.fn().mockReturnValue({
                accessToken: null
            })
            const callbackQueryString = 'state=botId=botId&rcUserId=rcUserId&code=authCode&scope=scope'

            // Act
            const res = await request(server).get(`/oauth-callback?${callbackQueryString}`);

            // Assert
            expect(res.status).toEqual(403);
            expect(res.text).toEqual('Params error');
        });
    });

    describe('authorization', () => {
        test('existing account - return error message', async () => {
            // Arrange
            let requestBody = null;
            getOAuthApp().code.getToken = jest.fn().mockReturnValue({
                accessToken,
                refreshToken,
                expires
            })
            const callbackQueryString = 'state=botId=botId&rcUserId=rcUserId&code=authCode&scope=scope'

            const googleGetUserScope = nock('https://www.googleapis.com')
                .get(`/drive/v3/about?fields=user`)
                .once()
                .reply(200, {
                    user: {
                        permissionId: googleUserId,
                        emailAddress: googleUserEmail,
                        displayName: 'displayName'
                    }
                });
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            const res = await request(server).get(`/oauth-callback?${callbackQueryString}`);

            // Assert
            expect(res.status).toEqual(200);
            expect(requestBody.text).toBe("Google Account googleUserEmail already exists.");

            // Clean up
            googleGetUserScope.done();
        });

        test('new account - return successful message', async () => {
            // Arrange
            let requestBody = null;
            rcAPI.getUserInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getUserInfo.userWithName);
            getOAuthApp().code.getToken = jest.fn().mockReturnValue({
                accessToken,
                refreshToken,
                expires
            })
            const callbackQueryString = 'state=botId=botId&rcUserId=rcUserId&code=authCode&scope=scope'

            const googleGetUserScope = nock('https://www.googleapis.com')
                .get(`/drive/v3/about?fields=user`)
                .once()
                .reply(200, {
                    user: {
                        permissionId: 'newGoogleUserId',
                        emailAddress: googleUserEmail,
                        displayName: 'displayName'
                    }
                });
            const googlePageTokenScope = nock('https://www.googleapis.com')
                .get(`/drive/v3/changes/startPageToken`)
                .once()
                .reply(200, {
                    startPageToken: 'startPageToken'
                });
            const googleWatchScope = nock('https://www.googleapis.com')
                .post(`/drive/v3/changes/watch?pageToken=startPageToken&pageSize=3&includeCorpusRemovals=true&includeItemsFromAllDrives=false&supportsAllDrives=false`)
                .once()
                .reply(200, {
                    id: 'watchId',
                    resourceId: 'resourceId'
                });
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            const res = await request(server).get(`/oauth-callback?${callbackQueryString}`);

            // Assert
            expect(res.status).toEqual(200);
            expect(requestBody.text).toBe("Authorized Google Account googleUserEmail for firstName lastName. Now that you've authorized the Google Drive Bot, you will start receiving notifications here when new files are shared with you.");

            // Clean up
            await GoogleUser.destroy({
                where: {
                    id: 'newGoogleUserId'
                }
            })
            googleGetUserScope.done();
            googlePageTokenScope.done();
            googleWatchScope.done();
        });
    });
});