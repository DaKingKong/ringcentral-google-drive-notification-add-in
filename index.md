## RingCentral Google Drive Add-In

RingCentral Google Drive Add-In is a bot for [RingCentral App](https://www.ringcentral.com/apps/rc-app) that provides features from within RingCentral App.


### Features

- Subscribe to `New Comment` and `New File Share` notifications so that you can immediately receive them from within RingCentral App
- Manage subscriptions by setting up the push mode to `Realtime`, `Daily` or `Weekly` so that you can control notification traffic
- Automatically detect Google file links in RingCentral App conversations and make sure all team members have file access

### Commands

- `@bot login`: **Login** with your Google Account
- `@bot logout`: **Logout** your Google Account and clear all subscriptions created by it
- `@bot checkauth`: **Check** team members on their Google Account login status and remind those who don't have Google Account authorized
- `@bot sub`: **Create** a new subscription for New Comment under this channel
- `@bot list`: **List** all subscriptions for New Comment under this channel
- `@bot config`: (**Only works in Direct Message**)**Config** user settings

### Data Usage Justification

The following content shows our service components and relevant data usage purpose:

- Get user data -> To fetch user info so to build up an user profile in our database for our features
- Subscribe to changes on your Google Drive -> To mointor new changes on your Google Drive and setup our server to receive corresponding info from Google services
- Get file changes data -> To fetch latest changes info so to identify the types of changes
- Get file data -> To fetch file info so to show users a clear and comprehensive message on both `New Comment` and `New File Share` notifications
- Get comment data -> To fetch comment info so to show users a clear and comprehensive message on `New Comment` notifications
- Create reply -> To create replies under comments so to let user be able to reply comments directly as from within [RingCentral App](https://www.ringcentral.com/apps/rc-app)
- Create file access permissions -> To create permissions so to grant user access to files
- Stop subscription channel -> To let user completely unsubscribe from new change notifications 

### Additional Info
- [Privacy Policy](https://www.ringcentral.com/legal/privacy-notice.html)
