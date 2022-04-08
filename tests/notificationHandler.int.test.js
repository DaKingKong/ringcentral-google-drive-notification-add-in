const request = require('supertest');
const rcAPI = require('../src/server/lib/rcAPI');
const { server } = require('../src/server.js');
const { GoogleUser } = require('../src/server/models/googleUserModel')
const { GoogleFile } = require('../src/server/models/googleFileModel')
const { Subscription } = require('../src/server/models/subscriptionModel')
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const nock = require('nock');
const mockAPIData = require('../tests/testData/mockAPIData.json');
const moment = require('moment');

const groupId = 'groupId';
const accessToken = 'accessToken';
const botId = 'botId';
const rcUserId = 'rcUserId';
const fileId = 'fileId';
const fileName = 'fileName';
const newFileName = 'newFileName';
const unknownRcUserId = 'unknownRcUserId';
const googleUserId = 'googleUserId';
const googleUserEmail = 'googleUserEmail';
const googleSubscriptionId = 'googleSubscriptionId';
const startPageToken = 'startPageToken';
const newStartPageToken = 'newStartPageToken';
const anotherCommentId = 'anotherCommentId';
const commentId = 'commentId';

const cardScope = nock(process.env.RINGCENTRAL_SERVER)
    .persist()
    .post(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`)
    .reply(200, 'OK');

beforeAll(async () => {
    rcAPI.createConversation = jest.fn().mockReturnValue(mockAPIData.rcAPI.createConversation.successfulCreation);
    await GoogleUser.create({
        id: googleUserId,
        rcUserId,
        email: googleUserEmail,
        googleSubscriptionId,
        startPageToken,
        botId,
        rcDMGroupId: groupId
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
    cardScope.done();
})

describe('notificationHandler', () => {
    describe('validations', () => {
        test('unknown googleSubscriptionId - 403', async () => {
            // Arrange
            const postData = {}

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', 'unknownGoogleSubscriptionId')
                .send(postData);

            // Assert
            expect(res.status).toEqual(403);
            expect(res.text).toEqual('Unknown googleSubscriptionId');
        });
    });

    describe('MISC', () => {
        test('update start page token', async () => {
            // Arrange
            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    newStartPageToken
                });


            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            const googleUser = await GoogleUser.findByPk(googleUserId);
            expect(googleUser.startPageToken).toEqual(newStartPageToken);
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            await googleUser.update({
                startPageToken: startPageToken
            });
        });

        test('file name change', async () => {
            // Arrange
            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: newFileName
                });


            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            const googleFile = await GoogleFile.findByPk(fileId);
            expect(googleFile.name).toEqual(newFileName);
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
            await googleFile.update({
                name: fileName
            });
        });
    });

    describe('new file share notification', () => {
        test('my file, not a new shared file - return nothing but 200', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: true,
                    sharedWithMeTime: dateString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleUser = await GoogleUser.findByPk(googleUserId);
            await googleUser.update({
                isReceiveNewFile: true
            });

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
        });

        test('not my file, config not to receive new file notification - return nothing but 200', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: false,
                    sharedWithMeTime: dateString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleUser = await GoogleUser.findByPk(googleUserId);
            await googleUser.update({
                isReceiveNewFile: false
            });

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
        });

        test('not my file, config to receive, new event - return successful card', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            let requestBody = null;
            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: false,
                    sharedWithMeTime: dateString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: 'Sharing User Name',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleUser = await GoogleUser.findByPk(googleUserId);
            await googleUser.update({
                isReceiveNewFile: true
            });

            cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            expect(requestBody.type).toBe('AdaptiveCard');
            expect(requestBody.body[0].text).toBe('**Sharing User Name** shared a file');

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
        });
    });

    describe('new comment notification', () => {
        const mockShareWithMeTimeString = 'Fri, 01 Apr 2022 03:29:05 GMT';
        test('no subscription - return nothing but 200', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: false,
                    sharedWithMeTime: mockShareWithMeTimeString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleUser = await GoogleUser.findByPk(googleUserId);
            await googleUser.update({
                isReceiveNewFile: true
            });

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
        });

        test('has sub, not a comment - return nothing but 200', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: true,
                    sharedWithMeTime: mockShareWithMeTimeString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleCommentScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\/comments.+$/)
                .once()
                .reply(200, {
                    comments: []
                });
            const sub = await Subscription.create({
                fileId,
                googleUserId,
                lastPushedCommentId: anotherCommentId
            })

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
            googleCommentScope.done();
            await sub.destroy();
        });

        test('has sub, not a new comment (has replies) - return nothing but 200', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: true,
                    sharedWithMeTime: mockShareWithMeTimeString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleCommentScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\/comments.+$/)
                .once()
                .reply(200, {
                    comments: [{
                        replies: [
                            {
                                id: 'replyId'
                            }
                        ]
                    }]
                });
            const sub = await Subscription.create({
                fileId,
                googleUserId,
                lastPushedCommentId: anotherCommentId
            })

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
            googleCommentScope.done();
            await sub.destroy();
        });

        test('has sub, not new comment (not new event according to dateTime) - return nothing but 200', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();
            const delayedDate = moment(date).add(5, 'm').toDate();
            const delayedDateString = delayedDate.toUTCString();

            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: true,
                    sharedWithMeTime: mockShareWithMeTimeString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleCommentScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\/comments.+$/)
                .once()
                .reply(200, {
                    comments: [{
                        replies: null,
                        modifiedTime: delayedDateString
                    }]
                });
            const sub = await Subscription.create({
                fileId,
                googleUserId,
                lastPushedCommentId: anotherCommentId
            })

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
            googleCommentScope.done();
            await sub.destroy();
        });

        test('has sub, not new comment (duplicated commentId) - return nothing but 200', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: true,
                    sharedWithMeTime: mockShareWithMeTimeString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleCommentScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\/comments.+$/)
                .once()
                .reply(200, {
                    comments: [{
                        replies: null,
                        modifiedTime: dateString
                    }]
                });
            const sub = await Subscription.create({
                fileId,
                googleUserId,
                lastPushedCommentId: commentId
            })

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
            googleCommentScope.done();
            await sub.destroy();
        });

        test('has sub, new comment, muted - return nothing but 200', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: true,
                    sharedWithMeTime: mockShareWithMeTimeString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleCommentScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\/comments.+$/)
                .once()
                .reply(200, {
                    comments: [{
                        replies: null,
                        modifiedTime: dateString,
                        author: {
                            displayName: ''
                        },
                        content: ''
                    }]
                });
            const sub = await Subscription.create({
                fileId,
                googleUserId,
                lastPushedCommentId: commentId,
                state: 'muted'
            })

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
            googleCommentScope.done();
            await sub.destroy();
        });

        test('has sub, new comment, realtime - return new comment card', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            let requestBody = null;
            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: true,
                    sharedWithMeTime: mockShareWithMeTimeString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleCommentScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\/comments.+$/)
                .once()
                .reply(200, {
                    comments: [{
                        replies: null,
                        modifiedTime: dateString,
                        author: {
                            displayName: ''
                        },
                        content: ''
                    }]
                });
            const sub = await Subscription.create({
                fileId,
                googleUserId,
                lastPushedCommentId: commentId,
                state: 'realtime',
                groupId
            })
            cardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
                requestBody = JSON.parse(reqBody);
            });

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            expect(res.status).toEqual(200);

            expect(requestBody.type).toBe('AdaptiveCard');
            expect(requestBody.body[0].text).toBe('New Comment');

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
            googleCommentScope.done();
            await sub.destroy();
        });

        test('has sub, new comment, daily - return nothing but 200 + save to db', async () => {
            // Arrange
            const date = new Date();
            const dateString = date.toUTCString();

            const postData = {}
            const googleChangeListScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/changes.+$/)
                .once()
                .reply(200, {
                    changes: [
                        {
                            type: 'file',
                            fileId,
                            time: dateString
                        }
                    ]
                });
            const googleFileScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\?fields.+$/)
                .once()
                .reply(200, {
                    name: fileName,
                    ownedByMe: true,
                    sharedWithMeTime: mockShareWithMeTimeString,
                    owners: [
                        {
                            displayName: 'Owner Name'
                        }
                    ],
                    iconLink: '',
                    name: fileName,
                    webViewLink: '',
                    sharingUser: {
                        photoLink: '',
                        displayName: '',
                        emailAddress: ''
                    },
                    permissions: []
                });
            const googleCommentScope = nock('https://www.googleapis.com')
                .get(/\/drive\/v3\/files\/fileId\/comments.+$/)
                .once()
                .reply(200, {
                    comments: [{
                        replies: null,
                        modifiedTime: dateString,
                        author: {
                            displayName: ''
                        },
                        content: ''
                    }]
                });
            const sub = await Subscription.create({
                id: 'subId',
                fileId,
                googleUserId,
                lastPushedCommentId: commentId,
                state: 'daily',
                groupId,
                cachedInfo:
                {
                    commentNotifications: []
                }
            })

            // Act
            const res = await request(server)
                .post('/notification')
                .set('x-goog-channel-id', googleSubscriptionId)
                .send(postData);

            // Assert
            const updatedSub = await Subscription.findByPk('subId');
            expect(res.status).toEqual(200);
            expect(updatedSub.cachedInfo.commentNotifications.length).toEqual(1);

            // Clean up
            googleChangeListScope.done();
            googleFileScope.done();
            googleCommentScope.done();
            await sub.destroy();
        });
    });
});