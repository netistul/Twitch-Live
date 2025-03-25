const twitchClientId = "z05n4woixewpyagrqrui76x28avd2g";

// Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open settings page only on first install
    openSettingsPage();
  }

  // Common initialization for install and update
  initializeExtension();
});

chrome.runtime.onStartup.addListener(initializeExtension);

// Common initialization function
function initializeExtension() {
  console.log("Initializing extension...");
  updateBadgeAtStartup();
  fetchList();
  createContextMenuItems();
  setupAlarm();
  const startupTime = Date.now();
  chrome.storage.local.set({ startupTime: startupTime }, () => {
    console.log("Startup time set.");
  });
}

function setupAlarm() {
  chrome.alarms.clear("fetchDataAlarm", () => {
    chrome.alarms.create("fetchDataAlarm", { periodInMinutes: 0.33 }); // Adjust time as needed
    console.log("Alarm set up");
  });
}

function fetchList() {
  chrome.storage.local.get(["twitchAccessToken", "userId"], (result) => {
    if (result.twitchAccessToken && result.userId) {
      // First fetch user profile to check for avatar updates
      fetchUserProfileUpdates(result.twitchAccessToken);
      // Then continue with fetching follows
      fetchFollowList(result.twitchAccessToken, result.userId);
    } else {
      console.log("Access Token or User ID not found.");
    }
  });
}

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetchDataAlarm") {
    fetchList(); // Call your data fetching function
  }
});

function openSettingsPage() {
  chrome.tabs.create({ url: "settings.html" });
}

// Add a listener for messages sent to the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Determine if the environment is Firefox
  const isFirefox = typeof browser !== "undefined" && browser.runtime && browser.runtime.id;

  // Handle the OAuth flow initiation message
  if (message.action === "startOAuth") {
    let redirectUri;

    if (isFirefox) {
      // Get the redirect URI for Firefox using browser.identity
      redirectUri = browser.identity.getRedirectURL();
    } else {
      // Dynamically generate the redirect URI for Chrome using the extension's runtime ID
      redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
    }

    // Construct the Twitch OAuth URL with the appropriate parameters
    const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${twitchClientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=user:read:follows`;

    // Launch the web authentication flow (browser-specific implementation)
    const launchWebAuthFlow = isFirefox
      ? browser.identity.launchWebAuthFlow
      : chrome.identity.launchWebAuthFlow;

    launchWebAuthFlow(
      {
        url: authUrl, // The constructed OAuth URL
        interactive: true, // Make the flow interactive
      },
      (redirectUrl) => {
        // Handle errors or the absence of a redirect URL
        if ((isFirefox && browser.runtime.lastError) || !redirectUrl) {
          console.error(
            "OAuth flow failed:",
            isFirefox ? browser.runtime.lastError : chrome.runtime.lastError
          );
          return;
        }

        // Extract the access token from the redirect URL
        const url = new URL(redirectUrl);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        if (accessToken) {
          // Save the access token to local storage
          const storage = isFirefox ? browser.storage.local : chrome.storage.local;
          storage.set({ twitchAccessToken: accessToken }, () => {
            console.log("Twitch Access Token saved");
            fetchUserProfile(accessToken); // Fetch and handle the user's profile
          });
        }
      }
    );
  }

  // Handle the message to disconnect the Twitch account
  if (message.action === "disconnectTwitch") {
    console.log("Disconnecting Twitch account via settings page");

    // Clear all related data from local storage
    const storage = isFirefox ? browser.storage.local : chrome.storage.local;
    storage.remove(
      [
        "twitchAccessToken",
        "followedList",
        "liveStreams",
        "userId",
        "userAvatar",
        "userDisplayName",
      ],
      () => {
        console.log(
          "Access token, followed list, live streams, and user information removed from storage."
        );
        // Reset the badge text for the extension icon
        const action = isFirefox ? browser.action : chrome.action;
        action.setBadgeText({ text: "" });
        sendResponse({ status: "success" }); // Send a success response to the sender
      }
    );

    return true; // Indicate an asynchronous response (important for Chrome v80+)
  }
});

function fetchUserProfile(accessToken) {
  fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": twitchClientId,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      const userProfile = data.data[0];
      const userId = userProfile.id; // Twitch user ID
      const avatarUrl = userProfile.profile_image_url; // Twitch user avatar URL
      const displayName = userProfile.display_name; // Twitch user display name

      // Store user ID, avatar URL, and display name in local storage
      chrome.storage.local.set(
        {
          userId: userId,
          userAvatar: avatarUrl,
          userDisplayName: displayName, // Storing the display name
        },
        () => {
          console.log("User ID, Avatar, and Display Name saved");
          fetchFollowList(accessToken, userId, true); // Continue with your other operations

        }
      );
    })
    .catch((error) => {
      // Handle any errors in the fetch operation
      console.error("Error fetching user profile:", error);
    });
}

function fetchFollowList(
  accessToken,
  userId,
  isOAuthComplete = false,
  cursor = "",
  followedList = []
) {
  let url = `https://api.twitch.tv/helix/channels/followed?user_id=${userId}&first=100`;
  if (cursor) {
    url += `&after=${cursor}`;
  }

  console.log("Fetching follow list with URL:", url);

  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-ID": twitchClientId,
    },
  };

  // Use fetchWithRetry instead of direct fetch
  fetchWithRetry(url, options)
    .then((data) => {
      // Handle null response (auth token expired case from fetchWithRetry)
      if (data === null) {
        console.log("Auth token expired or invalid, handled by fetchWithRetry");
        return;
      }

      // Process the data
      followedList = followedList.concat(data.data || []);

      // If there's pagination, fetch next page
      if (data.pagination && data.pagination.cursor) {
        fetchFollowList(
          accessToken,
          userId,
          isOAuthComplete,
          data.pagination.cursor,
          followedList
        );
      } else {
        // All pages fetched, save to storage and proceed
        chrome.storage.local.set({ followedList: followedList }, () => {
          console.log("Followed Channels saved in local storage");
          fetchStreamData(accessToken, followedList);

          if (isOAuthComplete) {
            // Send message without callback to avoid "port closed" error
            chrome.runtime.sendMessage({ action: "oauthComplete" });
            console.log("Notification sent to popup (if available)");
          }
        });
      }
    })
    .catch((error) => {
      console.error("Error fetching follow list after all retries:", error);
    });
}

function fetchStreamData(accessToken, followedList) {
  console.log("Fetching stream data...");

  const someThreshold = 60000;

  const streamFetchPromises = followedList.map((channel) => {
    if (!channel || !channel.broadcaster_login) {
      console.error("Invalid channel data:", channel);
      return Promise.resolve(null); // Skip this iteration gracefully
    }
    const streamUrl = `https://api.twitch.tv/helix/streams?user_login=${channel.broadcaster_login}`;

    return fetchWithRetry(streamUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": twitchClientId,
      },
    })
      .then((streamData) => {
        if (streamData && streamData.data && streamData.data.length > 0) {
          const stream = streamData.data[0];

          // Extract the thumbnail URL
          const thumbnailUrl = stream.thumbnail_url
            .replace("{width}", "320")
            .replace("{height}", "180");

          // Fetch the category and user data (for avatar) for live streams
          const categoryUrl = `https://api.twitch.tv/helix/games?id=${stream.game_id}`;
          const userUrl = `https://api.twitch.tv/helix/users?login=${channel.broadcaster_login}`;

          return Promise.all([
            fetchWithRetry(categoryUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": twitchClientId,
              },
            }),
            fetchWithRetry(userUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": twitchClientId,
              },
            }),
          ]).then(([categoryData, userData]) => {
            if (categoryData && userData) {
              const categoryName =
                categoryData.data && categoryData.data.length > 0
                  ? categoryData.data[0].name
                  : "Unknown Category";
              const avatarUrl =
                userData.data && userData.data.length > 0
                  ? userData.data[0].profile_image_url
                  : "";
              return {
                broadcasterLogin: channel.broadcaster_login,
                channelName: channel.broadcaster_name,
                title: stream.title,
                viewers: stream.viewer_count,
                category: categoryName,
                avatar: avatarUrl,
                thumbnail: thumbnailUrl,
                live: true,
                started_at: stream.started_at
              };
            }
            return null;
          });
        }
        return null;
      })
      .catch((error) => {
        console.error(
          "Error fetching stream data for channel:",
          channel.broadcaster_login,
          error
        );
        return null;
      });
  });

  Promise.all(streamFetchPromises).then((streamData) => {
    const liveStreams = streamData.filter((data) => data !== null);

    chrome.storage.local.get(
      {
        lastKnownLiveStreams: {},
        startupTime: 0,
        enableNotifications: false,
        selectedChannels: []
      },
      (result) => {
        let lastKnownLiveStreams = result.lastKnownLiveStreams;
        const startupTime = result.startupTime;
        const enableNotifications = result.enableNotifications;
        const selectedChannels = result.selectedChannels;
        const currentTime = Date.now();

        liveStreams.forEach((stream) => {
          const wasLive = lastKnownLiveStreams[stream.channelName];

          if (
            stream.live &&
            !wasLive &&
            currentTime - startupTime > someThreshold &&
            enableNotifications &&
            (selectedChannels.length === 0 || selectedChannels.includes(stream.channelName))
          ) {
            // Channel just went live, notifications are enabled, and channel is selected (or no filters)
            sendLiveNotification(stream);
          }

          // Update the last known live streams
          lastKnownLiveStreams[stream.channelName] = stream.live;
        });

        chrome.storage.local.set(
          {
            lastKnownLiveStreams: lastKnownLiveStreams,
            liveStreams: liveStreams,
          },
          () => {
            console.log("Live stream data and last known live streams updated in local storage");

            // Cache the count of live streams
            const liveCount = liveStreams.length;
            chrome.storage.local.set({ liveStreamCount: liveCount }, () => {
              chrome.action.setBadgeText({ text: liveCount.toString() });
              chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
            });
          }
        );
      }
    );
  });
}

// Utility function for handling retries with exponential backoff
function fetchWithRetry(url, options, maxRetries = 3, initialDelay = 1000) {
  return new Promise((resolve, reject) => {
    const attemptFetch = (retriesLeft, delay) => {
      fetch(url, options)
        .then(response => {
          if (response.status === 401) {
            console.log("Access token expired. Deleting token and triggering re-authentication.");
            chrome.storage.local.remove("twitchAccessToken", () => {
              console.log("Expired token removed from storage.");
            });

            // Set the token expiration flag back
            chrome.storage.local.set({ tokenExpired: true }, () => {
              console.log("Token expiration flag set in storage.");
            });

            resolve(null); // Continue with retry logic or null response
          }
          else if (response.status === 429 && retriesLeft > 0) {
            console.log(`Rate limited on ${url}, retrying in ${delay}ms. Retries left: ${retriesLeft}`);
            setTimeout(() => {
              attemptFetch(retriesLeft - 1, delay * 2);
            }, delay);
          } else if (response.status === 429) {
            console.error(`RATE LIMIT EXCEEDED after all retries for ${url}`);

            // Better endpoint detection
            let endpoint = 'unknown';
            if (url.includes('/channels/followed?')) {
              endpoint = 'followed';
            } else if (url.includes('/games?')) {
              endpoint = 'category';
            } else if (url.includes('/users?')) {
              endpoint = 'user';
            } else if (url.includes('/streams?')) {
              endpoint = 'stream';
            }

            // Extract channel info from URL if possible
            const channel = url.includes('login=') ? url.split('login=')[1].split('&')[0] : 'unknown';

            console.log(`Setting rateLimitHit=true AFTER ALL RETRIES for ${endpoint}`);

            // Only set the rate limit hit flag after all retries have failed
            chrome.storage.local.get(['lastRateLimitNotification'], function (data) {
              const now = Date.now();
              const lastNotification = data.lastRateLimitNotification || 0;

              // Only update the rate limit status and send notification if it's been at least 30 seconds
              if (now - lastNotification > 30000) {
                console.log(`Sending notification for ${endpoint} after all retries failed`);
                chrome.storage.local.set({
                  rateLimitHit: true,
                  rateLimitTimestamp: now,
                  lastRateLimitNotification: now,
                  rateLimitDetails: {
                    channel: channel,
                    endpoint: endpoint
                  }
                });

                chrome.runtime.sendMessage({
                  action: "rateLimitHit",
                  details: {
                    channel: channel,
                    endpoint: endpoint
                  }
                });
              } else {
                console.log(`Updating rateLimitHit but not sending notification (throttled)`);
                // Just update the timestamp without triggering a new notification
                chrome.storage.local.set({
                  rateLimitHit: true,
                  rateLimitTimestamp: now,
                  rateLimitDetails: {
                    channel: channel,
                    endpoint: endpoint
                  }
                });
              }
            });

            resolve({ data: [] });
          } else if (!response.ok) {
            console.error(`HTTP error: ${response.status} for ${url}`);
            if (retriesLeft > 0) {
              console.log(`Retrying in ${delay}ms due to HTTP error. Retries left: ${retriesLeft}`);
              setTimeout(() => {
                attemptFetch(retriesLeft - 1, delay * 2);
              }, delay);
            } else {
              reject(new Error(`HTTP error! status: ${response.status}`));
            }
          } else {
            resolve(response.json());
          }
        })
        .catch(error => {
          if (retriesLeft > 0) {
            console.log(`Error fetching ${url}, retrying in ${delay}ms. Error: ${error.message}`);
            setTimeout(() => {
              attemptFetch(retriesLeft - 1, delay * 2);
            }, delay);
          } else {
            console.error(`Failed to fetch ${url} after multiple retries: ${error.message}`);
            reject(error);
          }
        });
    };

    attemptFetch(maxRetries, initialDelay);
  });
}

function fetchUserProfileUpdates(accessToken) {
  fetchWithRetry("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": twitchClientId,
    },
  })
    .then((data) => {
      if (data === null) {
        console.log("Auth token expired or invalid during profile update check");
        return;
      }

      const userProfile = data.data[0];
      const avatarUrl = userProfile.profile_image_url;
      const displayName = userProfile.display_name;

      // Update the avatar and display name in storage
      chrome.storage.local.set(
        {
          userAvatar: avatarUrl,
          userDisplayName: displayName,
        },
        () => {
          console.log("User Avatar and Display Name updated");
        }
      );
    })
    .catch((error) => {
      console.error("Error updating user profile:", error);
    });
}

function sendLiveNotification(channel) {
  // Check if notifications are enabled and if the channel is selected
  chrome.storage.local.get(['enableNotifications', 'selectedChannels'], function (data) {
    const selectedChannels = data.selectedChannels || [];

    // Only send notification if:
    // 1. Notifications are enabled AND
    // 2. Either no channels are selected (meaning notify for all) OR the channel is in the selected list
    if (data.enableNotifications &&
      (selectedChannels.length === 0 || selectedChannels.includes(channel.channelName))) {
      chrome.notifications.create("liveNotification_" + channel.channelName, {
        type: "basic",
        iconUrl: channel.avatar || "default_icon.png",
        title: `${channel.channelName} is live!`,
        message: `${channel.channelName} is streaming ${channel.category}.`,
        priority: 2,
      });
    }
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "disconnectTwitch") {
    console.log("Context menu item clicked - Disconnecting Twitch account");

    // Remove specific items from the local storage
    chrome.storage.local.remove(
      [
        "twitchAccessToken",
        "followedList",
        "liveStreams",
        "userId", // Removing user ID
        "userAvatar", // Removing user avatar
        "userDisplayName", // Removing user display name
      ],
      () => {
        console.log(
          "Access token, followed list, live streams, and user information removed from storage."
        );
        chrome.action.setBadgeText({ text: "" });
      }
    );
  } else if (info.menuItemId === "openSettings") {
    console.log("Context menu item clicked - Opening Settings");

    // Open the settings page in a new tab
    chrome.tabs.create({
      url: "settings.html",
    });
  }
});

function updateBadgeAtStartup() {
  chrome.storage.local.get("liveStreamCount", (result) => {
    if (result.liveStreamCount !== undefined) {
      chrome.action.setBadgeText({ text: result.liveStreamCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
    } else {
      console.log("No cached live stream count found.");
    }
  });
}

function createContextMenuItems() {
  // Clear all existing context menu items first
  chrome.contextMenus.removeAll(() => {
    // Now, create new context menu items
    chrome.contextMenus.create({
      id: "openSettings",
      title: "Open Twitch Live Settings",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "disconnectTwitch",
      title: "Disconnect Twitch Account",
      contexts: ["action"],
    });
  });
}
