const twitchClientId = "z05n4woixewpyagrqrui76x28avd2g";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Creating context menu item for disconnecting Twitch account");
  chrome.contextMenus.create({
    id: "disconnectTwitch",
    title: "Disconnect Twitch Account",
    contexts: ["action"],
  });
  chrome.contextMenus.create({
    id: "openSettings",
    title: "Open Twitch Live Settings",
    contexts: ["action"],
  });

  fetchList();
  setInterval(fetchList, 3600000); // 1 hour
});

function fetchList() {
  console.log("fetchList called");
  chrome.storage.local.get(["twitchAccessToken", "userId"], (result) => {
    if (result.twitchAccessToken && result.userId) {
      fetchFollowList(result.twitchAccessToken, result.userId);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startOAuth") {
    const redirectUri = "https://fdghigkcpnnjfidmkfdfngojlapiaich.chromiumapp.org/";

    chrome.identity.launchWebAuthFlow({
      url: `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${twitchClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:read:follows`,
      interactive: true,
    }, (redirectUrl) => {
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
    });
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
    const userId = data.data[0].id;
    chrome.storage.local.set({ userId: userId }, () => {
      console.log("User ID saved");
      fetchFollowList(accessToken, userId, true); // Passing true for the OAuth completion
    });
  })
  .catch((error) => console.error("Error fetching user profile:", error));
}


function fetchFollowList(accessToken, userId, isOAuthComplete = false, cursor = "", followedList = []) {
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
      fetchFollowList(accessToken, userId, isOAuthComplete, data.pagination.cursor, followedList);
    } else {
      chrome.storage.local.set({ followedList: followedList }, () => {
        console.log("Followed Channels saved in local storage");
        fetchStreamData(accessToken, followedList);
        if (isOAuthComplete) {
          chrome.runtime.sendMessage({ action: "oauthComplete" }, function(response) {
            if (chrome.runtime.lastError) {
              // Handle message send error
              console.log("Error sending message to popup:", chrome.runtime.lastError.message);
            } else {
              // Message sent successfully
              console.log("Message sent successfully to popup");
            }
          });
        }
      });
    }
  })
  .catch((error) => console.error("Error fetching follow list:", error));
}


function fetchStreamData(accessToken, followedList) {
  console.log("Fetching stream data...");

  const streamFetchPromises = followedList.map(channel => {
    const streamUrl = `https://api.twitch.tv/helix/streams?user_login=${channel.broadcaster_login}`;

    return fetch(streamUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": twitchClientId,
      },
    })
    .then(response => {
      if (response.status === 401) {
        console.log("Access token expired. Deleting token and triggering re-authentication.");
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
    .then(streamData => {
      if (streamData && streamData.data && streamData.data.length > 0) {
        const stream = streamData.data[0];
        console.log(`Live Channel: ${channel.broadcaster_name}, Viewers: ${stream.viewer_count}`);

        // Fetch the category and user data (for avatar) for live streams
        const categoryUrl = `https://api.twitch.tv/helix/games?id=${stream.game_id}`;
        const userUrl = `https://api.twitch.tv/helix/users?login=${channel.broadcaster_login}`;

        return Promise.all([
          fetch(categoryUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Client-Id": twitchClientId,
            },
          }).then(response => response.json()),
          fetch(userUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Client-Id": twitchClientId,
            },
          }).then(response => response.json())
        ])
        .then(([categoryData, userData]) => {
          if (categoryData && userData) {
            const categoryName = categoryData.data && categoryData.data.length > 0 ? categoryData.data[0].name : "Unknown Category";
            const avatarUrl = userData.data && userData.data.length > 0 ? userData.data[0].profile_image_url : "";
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
    .catch(error => {
      console.error("Error fetching stream data for channel:", channel.broadcaster_login, error);
      return null;
    });
  });

  Promise.all(streamFetchPromises).then(streamData => {
    const liveStreams = streamData.filter(data => data !== null);
    chrome.storage.local.set({ liveStreams: liveStreams }, () => {
      console.log("Live stream data updated in local storage", liveStreams);
      // Update the badge text
      chrome.action.setBadgeText({ text: liveStreams.length.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#6441a5' }); // Twitch purple color
    });
  });  
}


// Fetch and update the live stream data periodically
setInterval(() => {
  chrome.storage.local.get(["twitchAccessToken", "followedList"], (result) => {
    if (result.twitchAccessToken && result.followedList) {
      console.log("Updating live stream data...");
      fetchStreamData(result.twitchAccessToken, result.followedList);
    }
  });
}, 20000); // 20 seconds interval

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "disconnectTwitch") {
    console.log("Context menu item clicked - Disconnecting Twitch account");
    
    // Remove specific items from the local storage
    chrome.storage.local.remove(["twitchAccessToken", "followedList", "liveStreams"], () => {
      console.log("Access token, followed list, and live streams removed from storage.");
      chrome.action.setBadgeText({ text: '' });
    });
  }
  else if (info.menuItemId === "openSettings") {
    console.log("Context menu item clicked - Opening Settings");

    // Hardcode the width and height for the window
    var screenWidth = 535;
    var screenHeight = 600;

    // Open the settings page in a new window
    chrome.windows.create({
      url: "settings.html",
      type: "popup",
      width: screenWidth,
      height: screenHeight
    });
  }
});

