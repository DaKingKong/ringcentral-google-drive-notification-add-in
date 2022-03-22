const cardBuilder = require('../src/server/lib/cardBuilder');
const { Subscription } = require('../src/server/models/subscriptionModel')
const { GoogleFile } = require('../src/server/models/googleFileModel')

describe('cardBuilder - subscriptionListCard', () => {
    test('has subscription', async () => {
        // Arrange
        const botId = 'botId';
        const groupId = 'groupId';

        const sub = await Subscription.create({
            id: 'testSub',
            groupId,
            botId,
            rcUserId: 'rcUserId',
            rcUserName: 'rcUserName',
            googleUserId: 'googleUserId',
            fileId: 'fileId',
            state: 'realtime',
            startTime: null,
            lastPushedCommentId: 'lastPushedCommentId',
            cachedInfo: {}
        })

        const file = await GoogleFile.create({
            id: 'fileId',
            name: 'fileName',
            iconLink: 'iconLink',
            ownerEmail: 'ownerEmail',
            url: 'url'
        })

        // Act
        const cardResponse = await cardBuilder.subscriptionListCard(botId, groupId);

        // Assert
        expect(cardResponse.card).not.toBeNull();
        expect(cardResponse.isSuccessful).toBe(true);

        // Clean up
        await sub.destroy();
        await file.destroy();
    });

    test('has no subscription', async () => {
        // Arrange
        const botId = 'botId';
        const groupId = 'groupId';

        // Act
        const cardResponse = await cardBuilder.subscriptionListCard(botId, groupId);

        // Assert
        expect(cardResponse.errorMessage).toBe('No subscription can be found. Please create with `sub` command.');
        expect(cardResponse.isSuccessful).toBe(false);
    });
}

)