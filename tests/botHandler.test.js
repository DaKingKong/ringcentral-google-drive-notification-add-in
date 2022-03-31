const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { GoogleUser } = require('../src/server/models/googleUserModel');
const { GoogleFile } = require('../src/server/models/googleFileModel');
const { Subscription } = require('../src/server/models/subscriptionModel');
const { botHandler } = require('../src/server/handlers/botHandler');
const authorizationHandler = require('../src/server/handlers/authorizationHandler');
const rcAPI = require('../src/server/lib/rcAPI');
const nock = require('nock');
const mockAPIData = require('./testData/mockAPIData.json');

const groupId = 'groupId';
const botId = 'botId';
const subId = 'subId';
const fileId = 'fileId';
const googleUserId = 'googleUserId';
const rcUserId = 'rcUserId';
const unknownRcUserId = 'unknownRcUserId';

const postScope = nock(process.env.RINGCENTRAL_SERVER)
    .persist()
    .post(`/restapi/v1.0/glip/groups/${groupId}/posts`)
    .reply(200, 'OK');
const cardScope = nock(process.env.RINGCENTRAL_SERVER)
    .persist()
    .post(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`)
    .reply(200, 'OK');

beforeAll(async () => {
    rcAPI.createConversation = jest.fn().mockReturnValue(mockAPIData.rcAPI.createConversation.successfulCreation);

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
    await GoogleFile.destroy({
        where: {
            id: fileId
        }
    });
    postScope.done();
    cardScope.done();
})

describe('botHandler', () => {

    describe('bot join group', () => {
        test('show welcome message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "BotJoinGroup",
                userId: unknownRcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).not.toBeNull();
        });
    });

    describe('@bot hello & help', () => {
        test('return hello message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "hello",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).not.toBeNull();
        });

        test('return help message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "help",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).not.toBeNull();
        });
    });

    describe('@bot login', () => {
        test('existing Google Account - error message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "login",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("You have already logged in.");
        });

        test('no Google Account - auth card', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "login",
                userId: unknownRcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.type).toBe('AdaptiveCard');
            expect(requestBody.body[0].text).toBe('Google Drive Login');
        });
    });

    describe('@bot logout', () => {
        test('no Google Account - error message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "logout",
                userId: unknownRcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("Google Drive account not found. Please type `login` to authorize your account.");
        });

        test('has Google Account - logout card', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "logout",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.type).toBe('AdaptiveCard');
            expect(requestBody.body[0].text).toBe('Google Drive Logout');
        });
    });

    describe('@bot checkauth', () => {
        test('all members authorized - all authorized message', async () => {
            // Arrange
            let requestBody = null;
            rcAPI.getGroupInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getGroupInfo.none)
            rcAPI.getBulkUserInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getBulkUserInfo.userAndBot);

            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "checkauth",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("All members authorized.");
        });

        test('a member not authorized - remind authorization message', async () => {
            // Arrange
            let requestBody = null;
            rcAPI.getGroupInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getGroupInfo.none)
            rcAPI.getBulkUserInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getBulkUserInfo.userAndUnauthorizedUser);

            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "checkauth",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("Google Drive account not found for following users:\n\n![:Person](unknownRcUserId) \n\nPlease @me with `login` command to authorize.");
        });
    });

    describe('@bot sub', () => {
        test('no Google Account - error message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "sub",
                userId: unknownRcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("Google Drive account not found. Please type `login` to authorize your account.");
        });

        test('has Google Account - sub card', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "sub",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.type).toBe('AdaptiveCard');
            expect(requestBody.body[0].text).toBe('Subscribe');
        });
    });

    describe('@bot config', () => {
        test('not Direct  Message - error message', async () => {
            // Arrange
            let requestBody = null;
            const postScopeToNonDirectMessageGroup = nock(process.env.RINGCENTRAL_SERVER)
                .persist()
                .post(`/restapi/v1.0/glip/groups/nonDirectMessageGroupId/posts`)
                .reply(200, 'OK');

            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "config",
                userId: rcUserId,
                bot,
                group: {
                    id: "nonDirectMessageGroupId"
                }
            }
            postScopeToNonDirectMessageGroup.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("`config` command is only supported in Direct Message.");
        });

        test('no Google Account - error message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "config",
                userId: unknownRcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("Google Drive account not found. Please type `login` to authorize your account.");
        });

        test('has Google Account and in Direct Message - config card', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "config",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.type).toBe('AdaptiveCard');
            expect(requestBody.body[0].text).toBe('Config');
        });
    });

    describe('@bot list', () => {
        test('no Google Account - error message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "list",
                userId: unknownRcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("Google Drive account not found. Please type `login` to authorize your account.");
        });

        test('has Google Account and sub - list card', async () => {
            // Arrange
            let requestBody = null;
            const sub = await Subscription.create({
                subId,
                botId,
                groupId,
                fileId,
                state: 'realtime'
            })
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "list",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.type).toBe('AdaptiveCard');
            expect(requestBody.body[0].text).toBe('**Active** subscriptions in this chat:');

            // Clean up
            await sub.destroy();
        });

        test('has Google Account, no sub - error message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "Message4Bot",
                text: "list",
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("No subscription can be found. Please create with `sub` command.");
        });
    });

    describe('Google File link posted', () => {
        const googleFileLink = 'https://docs.google.com/document/d/fileId/edit';

        test('no Google Account - error message', async () => {
            // Arrange
            let requestBody = null;
            const bot = await Bot.findByPk(botId);
            const event = {
                type: "PostAdded",
                message: {
                    body: {
                        text: googleFileLink,
                        groupId,
                        creatorId: unknownRcUserId
                    },
                    ownerId: botId
                },
                userId: unknownRcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.text).toBe("Google Drive file link detected. But ![:Person](unknownRcUserId) doesn't have an authorized Google Account. Please @me with `login` command to authorize.");
        });

        test('has Google Account, has Google File, all members have access - file info card', async () => {
            // Arrange
            let requestBody = null;
            rcAPI.getGroupInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getGroupInfo.none)
            rcAPI.getBulkUserInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getBulkUserInfo.userAndBot);

            const bot = await Bot.findByPk(botId);
            const event = {
                type: "PostAdded",
                message: {
                    body: {
                        text: googleFileLink,
                        groupId,
                        creatorId: rcUserId
                    },
                    ownerId: botId
                },
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert
            expect(requestBody.type).toBe('AdaptiveCard');
            expect(requestBody.body[0].text).toBe('Google Drive File');
        });

        test('sender has Google Account, has Google File, another member no Google Account - reminder message for login', async () => {
            // Arrange
            let requestBody = null;
            rcAPI.getGroupInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getGroupInfo.none)
            rcAPI.getBulkUserInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getBulkUserInfo.userAndUserWithoutFileAccess);

            const bot = await Bot.findByPk(botId);
            const event = {
                type: "PostAdded",
                message: {
                    body: {
                        text: googleFileLink,
                        groupId,
                        creatorId: rcUserId
                    },
                    ownerId: botId
                },
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            await botHandler(event);

            // Assert            
            expect(requestBody.text).toBe("Google Drive account not found for following users:\n\n![:Person](noFileRcUserId) \n\nPlease @me with `login` command to authorize.");
        });

        test('all has Google Account, has Google File, a member no File Access - file info card + no access message + access grant card', async () => {
            // Arrange
            let requestBody = null;
            rcAPI.getGroupInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getGroupInfo.none)
            rcAPI.getBulkUserInfo = jest.fn().mockReturnValueOnce(mockAPIData.rcAPI.getBulkUserInfo.user);

            authorizationHandler.checkUserFileAccess = jest.fn().mockReturnValueOnce(false);

            const bot = await Bot.findByPk(botId);
            const event = {
                type: "PostAdded",
                message: {
                    body: {
                        text: googleFileLink,
                        groupId,
                        creatorId: rcUserId
                    },
                    ownerId: botId
                },
                userId: rcUserId,
                bot,
                group: {
                    id: "groupId"
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });
            let cardRequestBody1 = null;
            let cardRequestBody2 = null;
            cardScope.on('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                if (!cardRequestBody1) {
                    cardRequestBody1 = JSON.parse(reqBody);
                }
                else {
                    cardRequestBody2 = JSON.parse(reqBody);
                }
            })

            // Act
            await botHandler(event);

            // Assert            
            expect(requestBody.text).toBe("Google Drive file link detected. Following users don\'t have access to above file\n ![:Person](rcUserId) ");

            expect(cardRequestBody1.type).toBe('AdaptiveCard');
            expect(cardRequestBody1.body[0].text).toBe('Google Drive File');
            expect(cardRequestBody2.type).toBe('AdaptiveCard');
            expect(cardRequestBody2.body[0].text).toBe('Grant File Access');
        });
    })
})