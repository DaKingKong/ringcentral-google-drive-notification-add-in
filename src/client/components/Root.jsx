import React, { useState, useEffect, Fragment } from 'react';
import { RcThemeProvider, RcLoading, RcAlert, RcButton, RcIcon, RcText, RcTypography, RcList, RcListItem, RcListItemIcon, RcListItemText } from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';
import { GdriveLogo, Comments, NewFile } from '@ringcentral/juno/icon';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 20px;
  justify-content: center;
  align-items: center;
`;

const ElementGroup = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: row;
`;

function SubscriptionBoard({
  subscribed
}) {
  return (
    <div>
      {subscribed != null && (
        <ElementGroup>
          <RcText>
            {subscribed ? 'following notifications are active:' : 'subscribe to following notifications:'}
          </RcText>
        </ElementGroup>
      )}
      <ElementGroup>
        <RcList>
          <RcListItem>
            <RcListItemIcon>
              <RcIcon symbol={Comments} color='action.primary' />
            </RcListItemIcon>
            <RcListItemText primary='New Comment' />
          </RcListItem>
          <RcListItem>
            <RcListItemIcon>
              <RcIcon symbol={NewFile} color='action.primary' />
            </RcListItemIcon>
            <RcListItemText primary='New File Share' />
          </RcListItem>
        </RcList>
      </ElementGroup>
      <br />
    </div>
  )
}

export function App({ integrationHelper, client }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [authorized, setAuthorized] = useState(client.authorized);
  const [userInfo, setUserInfo] = useState({});
  const [subscribed, setSubscribed] = useState(false);

  // Listen authorized state to load webhook data:
  useEffect(() => {
    // Listen RingCentral app submit event to submit data to server
    integrationHelper.on('submit', async (e) => {
      return {
        status: true,
      }
    });
    if (!authorized) {
      setUserInfo({});
      return;
    }
    async function getInfo() {
      setLoading(true);
      try {
        const { user: userInfo, hasSubscription: hasSubscription } = await client.getUserInfo();
        if (userInfo) {
          setUserInfo(userInfo);
          setSubscribed(hasSubscription);
        }
      } catch (e) {
        console.error(e);
        if (e.message === 'Unauthorized') {
          setError('Authorization required.');
          setAuthorized(false);
        } else {
          setError('Fetch data error please retry later');
        }
      }
      setLoading(false);
    }
    getInfo();
  }, [authorized, subscribed]);

  return (
    <RcThemeProvider>
      <RcLoading loading={loading}>
        {
          (error && error.length > 0) ? (
            <RcAlert severity="warning" onClose={() => setError('')}>
              {error}
            </RcAlert>
          ) : null
        }
        <Container>
          <ElementGroup>
            <RcIcon symbol={GdriveLogo} size="xxxlarge" />
          </ElementGroup>
          {
            (!authorized) ? (
              <div>
                <ElementGroup>
                  <RcTypography
                    color="textPrimary"
                    variant='title1'
                  >
                    Connect to subscribe:
                  </RcTypography>
                </ElementGroup>
                <ElementGroup>
                  <SubscriptionBoard />
                </ElementGroup>
                <ElementGroup>
                  <RcButton
                    onClick={() => {
                      setLoading(true);
                      integrationHelper.openWindow(client.authPageUri);
                      async function onAuthCallback(e) {
                        if (e.data && e.data.authCallback) {
                          window.removeEventListener('message', onAuthCallback);
                          if (e.data.authCallback.indexOf('error') > -1) {
                            setError('Authorization error')
                            setLoading(false);
                            return;
                          }
                          try {
                            // Authorize
                            await client.authorize(e.data.authCallback);
                            setAuthorized(true);
                          } catch (e) {
                            console.error(e);
                            setError('Authorization error please retry later.')
                          }
                          setLoading(false);
                        }
                      }
                      window.addEventListener('message', onAuthCallback);
                      setTimeout(() => {
                        setLoading(false);
                      }, 2000);
                    }}>
                    Connect to Google Drive
                  </RcButton>
                </ElementGroup>
              </div>
            ) : (
              <div>
                <RcText variant='title1'>{userInfo.name} ({userInfo.email})</RcText>
                <br />
                <SubscriptionBoard subscribed={subscribed} />
                {subscribed != null && ((subscribed) ? (
                  <ElementGroup>
                    <RcButton onClick={async () => {
                      setLoading(true);
                      try {
                        // Logout and Unsubscribe
                        await client.unsubscribe();
                        setSubscribed(false);
                        integrationHelper.send({ canSubmit: true });  // enable 'Finish' button on Add-In setup shell
                        setLoading(false);
                      } catch (e) {
                        console.error(e);
                        setLoading(false);
                        setError('Subscription error please retry later.');
                      }
                    }}>
                      Unsubscribe
                    </RcButton>
                  </ElementGroup>
                ) : (
                  <div>
                    <ElementGroup>
                      <RcButton disabled={subscribed} onClick={async () => {
                        setLoading(true);
                        try {
                          // Subscribe
                          await client.subscribe();
                          setSubscribed(true);
                          integrationHelper.send({ canSubmit: true });  // enable 'Finish' button on Add-In setup shell
                          setLoading(false);
                        } catch (e) {
                          console.error(e);
                          setLoading(false);
                          setError('Subscription error please retry later.');
                        }
                      }}>
                        Subscribe
                      </RcButton>
                    </ElementGroup>
                  </div>
                ))
                }
                <br />
                <ElementGroup>
                  <RcButton onClick={async () => {
                    setLoading(true);
                    try {
                      // Logout and Unsubscribe
                      await client.logout();
                      setLoading(false);
                      setAuthorized(false);
                    } catch (e) {
                      console.error(e);
                      setLoading(false);
                      setError('Logout error please retry later.');
                    }
                  }}>
                    Logout
                  </RcButton>
                </ElementGroup>
              </div>)
          }
        </Container>
      </RcLoading>
    </RcThemeProvider>
  );
}
