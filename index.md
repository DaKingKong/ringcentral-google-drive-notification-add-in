## RingCentral Google Drive Add-In

RingCentral’s Google Drive Add-in is a bot within [RingCentral App](https://www.ringcentral.com/apps/rc-app) that alerts users to `new file shares` and `new comments`.  In addition to these key features, the following additional features are available with this integration:
- Be notified of new file shares and comments without leaving the RingCentral App and checking your email. 
- Interact with comments by submitting your own comments to a Google doc without ever leaving RingCentral.
- Received notifications the way you want to in Realtime, Daily or Weekly to control your interaction with Google Drive
- Automatically detect Google file links in RingCentral App conversations and make sure all team members have file access

### How To Use

- `@bot login`: **Login** with your Google Account
- `@bot logout`: **Logout** your Google Account and clear all subscriptions created by it
- `@bot checkauth`: **Check** team members on their Google Account login status and remind those who don't have Google Account authorized
- `@bot sub`: **Create** a new subscription for New Comment under this channel
- `@bot list`: **List** all subscriptions for New Comment under this channel
- `@bot config`: (**Only works in Direct Message**)**Config** user settings

[![RingCentral Google Drive Bot](https://res.cloudinary.com/marcomontalbano/image/upload/v1648875992/video_to_markdown/images/youtube--_Xa2__K3Jaw-c05b58ac6eb4c4700831b2b3070cd403.jpg)](https://youtu.be/_Xa2__K3Jaw "RingCentral Google Drive Bot")

### Data Usage Justification

The following content shows what we do with your Google Drive data:

| Data Action                               	| Purpose                                                                                                                 	|
|-------------------------------------------	|-------------------------------------------------------------------------------------------------------------------------	|
| Get user data                             	| fetch user info so to build up an user profile in our database for our features                                         	|
| Subscribe to changes on your Google Drive 	| monitor new changes on your Google Drive and setup our server to receive corresponding info from Google services        	|
| Get file changes data                     	| fetch latest changes info so to identify the types of changes                                                           	|
| Get file data                             	| fetch file info so to show users a clear and comprehensive message on both New Comment and New File Share notifications 	|
| Get comment data                          	| fetch comment info so to show users a clear and comprehensive message on New Comment notifications                      	|
| Create reply                              	| create replies under comments so to let user be able to reply comments directly as from within RingCentral App          	|
| Create file access permissions            	| create permissions so to grant user access to files                                                                     	|
| Stop subscription channel                 	| let user completely unsubscribe from new change notifications                                                           	|

### Additional Info
- [Privacy Policy](https://www.ringcentral.com/legal/privacy-notice.html)
