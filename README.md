# RingCentral-Google-Drive-Notification-Add-In

[![Build Status](https://github.com/ringcentral/ringcentral-google-drive-notification-add-in/workflows/CI%20Pipeline/badge.svg?branch=main)](https://github.com/ringcentral/ringcentral-google-drive-notification-add-in/actions)
[![Coverage Status](https://coveralls.io/repos/github/ringcentral/ringcentral-google-drive-notification-add-in/badge.svg?branch=main)](https://coveralls.io/github/ringcentral/ringcentral-google-drive-notification-add-in?branch=main)

Hello human, I'm a bot that lives in RingCentral App environment and can help you with following use cases:

- Subscribe to `New Comment` and `New File Share` notifications so that you can immediately receive them from within RingCentral App
- Manage subscriptions by setting up the push mode to `Realtime`, `Daily` or `Weekly` so that you can control notification traffic
- Automatically detect `Google file links` in RingCentral App conversations and make sure all team members have file access

Command me with:

- `login`: Login with your Google Account
- `logout`: Logout your Google Account and clear all subscriptions created by it
- `checkauth`: Check team members on their Google Account login status and remind those - who don’t have Google Account authorized
- `sub`: Create a new subscription for New Comment under this channel
- `list`: List all subscriptions for New Comment under this channel
- `config`: (**Only works in Direct Message**) Config user settings