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
  console.log("fetchList called");
  chrome.storage.local.get(["twitchAccessToken", "userId"], (result) => {
    if (result.twitchAccessToken && result.userId) {
      fetchFollowList(result.twitchAccessToken, result.userId);
    }
  });
}

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetchDataAlarm") {
    console.log("Alarm triggered");
    fetchList(); // Call your data fetching function
  }
});

function openSettingsPage() {
  chrome.tabs.create({ url: "settings.html" });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startOAuth") {
    const redirectUri =
      "https://hbahknjghhdefhjoeebaiaiogcbhmbll.chromiumapp.org/";

    chrome.identity.launchWebAuthFlow(
      {
        url: `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${twitchClientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&scope=user:read:follows`,
        interactive: true,
      },
      (redirectUrl) => {
        if (redirectUrl) {
          const url = new URL(redirectUrl);
          const hash = url.hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get("access_token");
          if (accessToken) {
            chrome.storage.local.set({ twitchAccessToken: accessToken }, () => {
              console.log("Twitch Access Token saved");
              fetchUserProfile(accessToken);
            });
          }
        }
      }
    );
  }
  // Handle the logout message
  if (message.action === "disconnectTwitch") {
    console.log("Disconnecting Twitch account via settings page");
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
        // Optionally, send a response back
        sendResponse({ status: "success" });
      }
    );
    return true; // indicates you wish to send a response asynchronously (important for Chrome v80+)
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

          // Send a message to the popup to indicate the profile has been updated
          chrome.runtime.sendMessage(
            { action: "profileUpdated" },
            function (response) {
              if (chrome.runtime.lastError) {
                // Handle any message send error
                console.log(
                  "Error sending message to popup:",
                  chrome.runtime.lastError.message
                );
              } else {
                // Confirm the message was sent successfully
                console.log("Message sent successfully to popup");
              }
            }
          );
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

  console.log("Fetching follow list...");

  fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": twitchClientId,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      followedList = followedList.concat(data.data);
      if (data.pagination && data.pagination.cursor) {
        // If there's more data, keep fetching
        fetchFollowList(
          accessToken,
          userId,
          isOAuthComplete,
          data.pagination.cursor,
          followedList
        );
      } else {
        // Only now, when all data is fetched, call fetchStreamData
        chrome.storage.local.set({ followedList: followedList }, () => {
          console.log("Followed Channels saved in local storage");
          fetchStreamData(accessToken, followedList);
          if (isOAuthComplete) {
            chrome.runtime.sendMessage(
              { action: "oauthComplete" },
              function (response) {
                if (chrome.runtime.lastError) {
                  console.log(
                    "Error sending message to popup:",
                    chrome.runtime.lastError.message
                  );
                } else {
                  console.log("Message sent successfully to popup");
                }
              }
            );
          }
        });
      }
    })
    .catch((error) => console.error("Error fetching follow list:", error));
}

function fetchStreamData(accessToken, followedList) {
  console.log("Fetching stream data...");

  const someThreshold = 60000;

  const streamFetchPromises = followedList.map((channel) => {
    const streamUrl = `https://api.twitch.tv/helix/streams?user_login=${channel.broadcaster_login}`;

    return fetch(streamUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": twitchClientId,
      },
    })
      .then((response) => {
        if (response.status === 401) {
          console.log(
            "Access token expired. Deleting token and triggering re-authentication."
          );
          // Delete the expired token
          chrome.storage.local.remove("twitchAccessToken", () => {
            console.log("Expired token removed from storage.");
            // You could also send a message to the popup to update the UI
            // chrome.runtime.sendMessage({ action: "updateUIForLogin" });
          });
          return null;
        }
        return response.json();
      })
      .then((streamData) => {
        if (streamData && streamData.data && streamData.data.length > 0) {
          const stream = streamData.data[0];
          console.log(
            `Live Channel: ${channel.broadcaster_name}, Viewers: ${stream.viewer_count}`
          );

          // Fetch the category and user data (for avatar) for live streams
          const categoryUrl = `https://api.twitch.tv/helix/games?id=${stream.game_id}`;
          const userUrl = `https://api.twitch.tv/helix/users?login=${channel.broadcaster_login}`;

          return Promise.all([
            fetch(categoryUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": twitchClientId,
              },
            }).then((response) => response.json()),
            fetch(userUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": twitchClientId,
              },
            }).then((response) => response.json()),
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
                channelName: channel.broadcaster_name,
                viewers: stream.viewer_count,
                category: categoryName, // Add the category name
                avatar: avatarUrl, // Add the avatar URL
                live: true,
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

    chrome.storage.local.get({ lastKnownLiveStreams: {}, startupTime: 0, enableNotifications: false }, (result) => {
      let lastKnownLiveStreams = result.lastKnownLiveStreams;
      const startupTime = result.startupTime;
      const enableNotifications = result.enableNotifications;
      const currentTime = Date.now();

      liveStreams.forEach(stream => {
        const wasLive = lastKnownLiveStreams[stream.channelName];

        if (stream.live && !wasLive && (currentTime - startupTime > someThreshold) && enableNotifications) {
          // Channel just went live after the startup threshold and notifications are enabled, send notification
          sendLiveNotification(stream);
        }

        // Update the last known live streams
        lastKnownLiveStreams[stream.channelName] = stream.live;
      });

      chrome.storage.local.set({ lastKnownLiveStreams: lastKnownLiveStreams, liveStreams: liveStreams }, () => {
        console.log("Live stream data and last known live streams updated in local storage");

        // Cache the count of live streams
        const liveCount = liveStreams.length;
        chrome.storage.local.set({ liveStreamCount: liveCount }, () => {
          console.log("Live stream count cached");

          // Update the badge with the live stream count
          chrome.action.setBadgeText({ text: liveCount.toString() });
          chrome.action.setBadgeBackgroundColor({ color: "#6366f1" }); // Twitch purple color
        });
      });
    });
  });
}

function sendLiveNotification(channel) {
  chrome.notifications.create('liveNotification_' + channel.channelName, {
    type: 'basic',
    iconUrl: channel.avatar || 'default_icon.png', // Default icon if no avatar
    title: `${channel.channelName} is live!`,
    message: `${channel.channelName} is streaming ${channel.category}.`,
    priority: 2
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

    // Hardcode the width and height for the window
    var screenWidth = 585;
    var screenHeight = 800;

    // Open the settings page in a new window
    chrome.windows.create({
      url: "settings.html",
      type: "popup",
      width: screenWidth,
      height: screenHeight,
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
