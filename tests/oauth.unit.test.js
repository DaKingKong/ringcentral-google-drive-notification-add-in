const { getOAuthApp, checkAndRefreshAccessToken } = require('../src/server/lib/oauth');
const { GoogleUser } = require('../src/server/models/googleUserModel');
const moment = require('moment');

describe('oauth', () => {
    test('check and refresh access token - accessToken updated', async () => {
        // Arrange
        const newAccessToken = 'newAccessToken';
        const newRefreshToken = 'newRefreshToken';

        const date = new Date();
        const previousDate = moment(date).add(-5, 'm').toDate();
        const previousDateString = previousDate.toISOString();
        const newDate = moment(date).add(5, 'm').toDate();
        const newDateString = newDate.toISOString();

        const googleUser = await GoogleUser.create({
            id: 'googleUserId',
            accessToken: 'accessToken',
            refreshToken: 'refreshToken',
            tokenExpiredAt: previousDateString
        });

        const oauthApp = getOAuthApp();
        const mockTokenRefreshFunction = jest.fn().mockReturnValue(
            {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expires: newDateString
            }
        );
        oauthApp.createToken = jest.fn().mockReturnValue({
            refresh: mockTokenRefreshFunction
        });

        // Act
        await checkAndRefreshAccessToken(googleUser);

        // Assert
        const updatedGoogleUser = await GoogleUser.findByPk('googleUserId');
        expect(updatedGoogleUser.accessToken).toBe(newAccessToken);
        expect(updatedGoogleUser.refreshToken).toBe(newRefreshToken);
        expect(updatedGoogleUser.tokenExpiredAt.toISOString()).toBe(newDateString);

        // Clean up
        await updatedGoogleUser.destroy();
    });
});