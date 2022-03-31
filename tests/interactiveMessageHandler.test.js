const request = require('supertest');
const rcAPI = require('../src/server/lib/rcAPI');
const { server } = require('../src/server.js');
const { GoogleUser } = require('../src/server/models/googleUserModel')
const { GoogleFile } = require('../src/server/models/googleFileModel')
const { Subscription } = require('../src/server/models/subscriptionModel')
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const nock = require('nock');
const mockAPIData = require('./testData/mockAPIData.json');

const groupId = 'groupId';
const accessToken = 'accessToken';
const botId = 'botId';
const rcUserId = 'rcUserId';
const fileId = 'fileId';
const fileName = 'fileName';
const unknownRcUserId = 'unknownRcUserId';
const googleUserId = 'googleUserId';
const googleUserEmail = 'googleUserEmail';

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
    await GoogleUser.create({
        id: googleUserId,
        rcUserId,
        email: googleUserEmail
    });
    await GoogleFile.create({
        id: fileId,
        name: fileName,
        iconLink: '',
        ownerEmail: googleUserEmail,
        url: ''
    })
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
    await GoogleFile.destroy({
        where: {
            id: fileId
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

describe('interactiveMessageHandler', () => {
    describe('validations', () => {
        test('no body.data - 400 error', async () => {
            // Arrange
            const postData = {
                data: null
            }

            // Act
            const res = await request(server).post('/interactive-messages').send(postData);

            // Assert
            expect(res.status).toEqual(400);
            expect(res.text).toEqual('Params error');
        });

        test('no body.user - 400 error', async () => {
            // Arrange
            const postData = {
                data: {},
                user: null
            }

            // Act
            const res = await request(server).post('/interactive-messages').send(postData);

            // Assert
            expect(res.status).toEqual(400);
            expect(res.text).toEqual('Params error');
        });

        test('no body.data - 400 error', async () => {
            // Arrange
            const postData = {
                data: {
                    botId: null
                },
                user: {}
            }

            // Act
            const res = await request(server).post('/interactive-messages').send(postData)

            // Assert
            expect(res.status).toEqual(400);
            expect(res.text).toEqual('Params error');
        });

        test('unknown bot id - 400 error', async () => {
            // Arrange
            const postData = {
                data: {
                    botId: 'unknownBotId'
                },
                user: {}
            }

            // Act
            const res = await request(server).post('/interactive-messages').send(postData)

            // Assert
            expect(res.status).toEqual(400);
            expect(res.text).toEqual('Bot not found');
        });

        test('no Google Account - return error message', async () => {
            // Arrange
            let requestBody = null;
            const postData = {
                data: {
                    botId
                },
                user: {
                    extId: unknownRcUserId
                },
                conversation: {
                    id: groupId
                }
            }
            postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            const res = await request(server).post('/interactive-messages').send(postData)

            // Assert
            expect(res.status).toEqual(200);
            expect(requestBody.text).toBe("![:Person](unknownRcUserId) Google Drive account not found. Please message me with \`login\` to login.");
        });
    });

    describe('submissions', () => {
        describe('unAuthCard', () => {
            test('return the card', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'unAuthCard'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);

                expect(requestBody.type).toBe('AdaptiveCard');
                expect(requestBody.body[0].text).toBe('Google Drive Logout');
            });
        })

        describe('subCard', () => {
            test('return the card', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'subCard'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);

                expect(requestBody.type).toBe('AdaptiveCard');
                expect(requestBody.body[0].text).toBe('Subscribe');
            });
        })

        describe('listCard', () => {
            test('no sub in channel - return error message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'listCard'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe("No subscription can be found. Please create with `sub` command.");
            });

            test('realtime sub in channel - return list card', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'listCard'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });
                const sub = await Subscription.create({
                    id: 'subId',
                    botId,
                    groupId,
                    fileId,
                    state: 'realtime'
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);

                expect(requestBody.type).toBe('AdaptiveCard');
                expect(requestBody.body[0].text).toBe('**Active** subscriptions in this chat:');

                // Clean up
                await sub.destroy();
            });
        });

        describe('subscribe', () => {
            const googleFileLink = 'https://docs.google.com/document/d/fileId/edit';
            const unknownGoogleFileLink = 'https://docs.google.com/document/d/unknownFileId/edit';

            test('duplicated fileId - return error message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'subscribe',
                        inputLinks: googleFileLink

                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                const sub = await Subscription.create({
                    id: 'subId',
                    botId,
                    groupId,
                    fileId,
                    state: 'realtime'
                });


                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe("**Failed to create**. Subscription for file: **fileName** already exists.");

                // Clean up
                await sub.destroy();
            });

            test('unknown fileId - return error message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'subscribe',
                        inputLinks: unknownGoogleFileLink

                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                const sub = await Subscription.create({
                    id: 'subId',
                    botId,
                    groupId,
                    fileId,
                    state: 'realtime'
                });

                const googleFileScope = nock('https://www.googleapis.com')
                    .get(`/drive/v3/files/unknownFileId?fields=id%2C%20name%2C%20webViewLink%2C%20iconLink%2C%20owners&supportsAllDrives=true`)
                    .once()
                    .reply(404);

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe("**Failed to create**. Unable to find file with id: unknownFileId with Google Account: googleUserEmail");

                // Clean up
                await sub.destroy();
                googleFileScope.done();
            });

            test('new fileId realtime - return successful message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'subscribe',
                        inputLinks: googleFileLink,
                        state: 'realtime'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                const googleFileScope = nock('https://www.googleapis.com')
                    .get(`/drive/v3/files/fileId?fields=id%2C%20name%2C%20webViewLink%2C%20iconLink%2C%20owners&supportsAllDrives=true`)
                    .once()
                    .reply(200, {
                        id: fileId,
                        name: fileName,
                        iconLink: '',
                        owners: null,
                        webViewLink: ''
                    });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe("**Subscription created**. Now watching new comment events for file: **fileName**.");

                // Clean up
                await Subscription.destroy({
                    where: {
                        groupId,
                        botId,
                        fileId
                    }
                })
                googleFileScope.done();
            });

            test('new fileId daily - return successful message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'subscribe',
                        inputLinks: googleFileLink,
                        state: 'daily',
                        hourOfDay: '8',
                        dayOfWeek: '1',
                        timezoneOffset: '0'
                    },
                    user: {
                        firstName: 'test',
                        lastName: 'test',
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                const googleFileScope = nock('https://www.googleapis.com')
                    .get(`/drive/v3/files/fileId?fields=id%2C%20name%2C%20webViewLink%2C%20iconLink%2C%20owners&supportsAllDrives=true`)
                    .once()
                    .reply(200, {
                        id: fileId,
                        name: fileName,
                        iconLink: '',
                        owners: null,
                        webViewLink: ''
                    });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe("**Subscription created**. Now watching new comment events for file: **fileName**.");

                // Clean up
                await Subscription.destroy({
                    where: {
                        fileId
                    }
                })
                googleFileScope.done();
            });
        });


        describe('subscriptionConfig', () => {
            test('return the card', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'subscriptionConfig'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);

                expect(requestBody.type).toBe('AdaptiveCard');
                expect(requestBody.body[0].text).toBe('Subscription Config');
            });
        });

        describe('muteSubscription', () => {
            test('return message + update sub state', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'muteSubscription',
                        fileId,
                        fileName
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });
                await Subscription.create({
                    id: 'subId',
                    botId,
                    groupId,
                    fileId,
                    state: 'realtime'
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)
                const updatedSub = await Subscription.findByPk('subId');

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe('**Muted file**: **fileName**');

                expect(updatedSub.state).toBe('muted');

                // Clean up
                await updatedSub.destroy();
            });
        });

        describe('updateSubscription', () => {
            test('return message + update sub state', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'updateSubscription',
                        fileId,
                        fileName,
                        state: 'daily',
                        hourOfDay: '8',
                        dayOfWeek: '1',
                        timezoneOffset: '0'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });
                await Subscription.create({
                    id: 'subId',
                    botId,
                    groupId,
                    fileId,
                    state: 'realtime'
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)
                const updatedSub = await Subscription.findByPk('subId');

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe('**Updated file**: **fileName**');

                expect(updatedSub.state).toBe('daily');

                // Clean up
                await updatedSub.destroy();
            });
        });

        describe('unsubscribe', () => {
            test('return message + update sub state', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'unsubscribe',
                        fileId,
                        fileName
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });
                await Subscription.create({
                    id: 'subId',
                    botId,
                    groupId,
                    fileId,
                    state: 'realtime'
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)
                const updatedSub = await Subscription.findByPk('subId');

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe('**Unsubscribed file**: **fileName**');

                expect(updatedSub).toBeNull();
            });
        });

        describe('replyComment', () => {
            test('no access - return error message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'replyComment',
                        fileId,
                        fileName,
                        commentId: 'commentId',
                        replyText: 'replyText'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                const googleCommentScope = nock('https://www.googleapis.com')
                    .post(`/drive/v3/files/fileId/comments/commentId/replies?fields=%2A`)
                    .once()
                    .reply(403);

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe('![:Person](rcUserId) Your Google Account (googleUserEmail) does not have access to reply comment under this file.');

                // Clean up
                googleCommentScope.done();
            });

            test('has access - return successful message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'replyComment',
                        fileId,
                        fileName,
                        commentId: 'commentId',
                        replyText: 'replyText'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                const googleCommentScope = nock('https://www.googleapis.com')
                    .post(`/drive/v3/files/fileId/comments/commentId/replies?fields=%2A`)
                    .once()
                    .reply(200);

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe('Comment replied.');

                // Clean up
                googleCommentScope.done();
            });
        });

        describe('grantAccess', () => {
            test('no access - return error message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'grantAccess',
                        fileId,
                        fileName,
                        permissionRole: 'Viewer',
                        googleUserInfo: [
                            {
                                email: googleUserEmail
                            }
                        ]
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                const googleGrantAccessScope = nock('https://www.googleapis.com')
                    .post(`/drive/v3/files/fileId/permissions?sendNotificationEmail=false`)
                    .once()
                    .reply(403);

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe('Failed to grant access. Only file owner can grant access.');

                // Clean up
                googleGrantAccessScope.done();
            });

            test('has access - return successful message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'grantAccess',
                        fileId,
                        fileName,
                        permissionRole: 'Viewer',
                        googleUserInfo: [
                            {
                                email: googleUserEmail
                            }
                        ]
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                const googleGrantAccessScope = nock('https://www.googleapis.com')
                    .post(`/drive/v3/files/fileId/permissions?sendNotificationEmail=false`)
                    .once()
                    .reply(200);

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe('Access granted.');

                // Clean up
                googleGrantAccessScope.done();
            });
        });

        describe('turn NewFileShareNotification', () => {
            test('turn On - return successful message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'turnOnNewFileShareNotification'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)
                const updatedGoogleUser = await GoogleUser.findByPk(googleUserId);

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe('New File Share notifications turned ON. You will START receiving notifications when there is a new file shared with you.');
            
                expect(updatedGoogleUser.isReceiveNewFile).toBe(true);
            });

            test('turn Off - return successful message', async () => {
                // Arrange
                let requestBody = null;
                const postData = {
                    data: {
                        botId,
                        actionType: 'turnOffNewFileShareNotification'
                    },
                    user: {
                        extId: rcUserId
                    },
                    conversation: {
                        id: groupId
                    }
                }
                postScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                    requestBody = JSON.parse(reqBody);
                });

                // Act
                const res = await request(server).post('/interactive-messages').send(postData)
                const updatedGoogleUser = await GoogleUser.findByPk(googleUserId);

                // Assert
                expect(res.status).toEqual(200);
                expect(requestBody.text).toBe('New File Share notifications turned OFF. You will STOP receiving notifications when there is a new file shared with you.');
            
                expect(updatedGoogleUser.isReceiveNewFile).toBe(false);
            });
        });
    });
})