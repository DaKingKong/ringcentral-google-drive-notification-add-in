## RingCentral Google Drive Add-In

RingCentral’s Google Drive Add-in is a bot within [RingCentral App](https://www.ringcentral.com/apps/rc-app) that alerts users to `NEW FILE SHARES` and `NEW COMMENTS`.  In addition to these key features, the following additional features are available with this integration:
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

<iframe width="560" height="315" src="https://www.youtube.com/embed/WKPXDZQ38qU" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

### Data Usage Justification

The following content shows what we do with your Google Drive data:

| Data Action                               	| Purpose                                                                                                                 	|
|-------------------------------------------	|-------------------------------------------------------------------------------------------------------------------------	|
| Get user data                             	| collect user information so we know who has access to a document or who is subscribing to events                                         	|
| Subscribe to changes on your Google Drive 	| monitor document changes on your Google Drive and send the details about what changed so we can notify you of the changes        	|
| Get file changes data                     	| actively get the latest changes to a document so we can identify the types of changes made to it                                                           	|
| Get file data                             	| 
specifically retrieve details about the comment like who wrote it and what did they say along with new file share notifications 	|
| Get comment data                          	| actively get the comment info so to show users a clear and comprehensive message on new comment notifications                      	|
| Create reply                              	| 
create a reply from you to comments in a Google Doc directly from within RingCentral App          	|
| Create file access permissions            	| allow you to grant user access to files by creating the appropriate permission                                                                     	|
| Stop subscription channel                 	| let user completely unsubscribe from new change notifications                                                           	|

### Additional Info
- [Privacy Policy](https://www.ringcentral.com/legal/privacy-notice.html)
