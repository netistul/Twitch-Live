//background.js
// --- Constants ---
const TWITCH_CLIENT_ID = "z05n4woixewpyagrqrui76x28avd2g";
const FETCH_ALARM_NAME = "fetchDataAlarm";
const FETCH_INTERVAL_SECONDS = 20; // Set to 20 seconds
const FETCH_ALARM_PERIOD_MINUTES = FETCH_INTERVAL_SECONDS / 60; // Auto-converts to minutes
const RATE_LIMIT_NOTIFICATION_COOLDOWN_MS = 30000; // 30 seconds
const NEW_STREAM_NOTIFICATION_DELAY_MS = 60000; // 1 minute after startup

// --- Extension Lifecycle & Initialization ---

// Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[INIT] Extension installed or updated:", details.reason);
  if (details.reason === "install") {
    openSettingsPage(); // Open settings page only on first install
  }
  // Common initialization for install and update
  initializeExtension();
});

// Listener for when the browser starts
chrome.runtime.onStartup.addListener(() => {
  console.log("[INIT] Browser started, initializing extension.");
  initializeExtension();
});

/**
 * Performs initial setup when the extension starts or is updated.
 */
function initializeExtension() {
  console.log("[INIT] Initializing extension...");

  // Clear any previous rate limit flags on startup/reload
  chrome.storage.local.remove(
    ["rateLimitHit", "rateLimitTimestamp", "rateLimitDetails", "lastRateLimitNotification"],
    () => {
      console.log("[INIT] Cleared previous rate limit flags");
    }
  );

  // Update badge based on stored count
  updateBadge();

  // Initial data fetch
  fetchList();

  // Setup right-click menu items
  createContextMenuItems();

  // Setup alarm using the simple, reliable method from old version
  setupAlarm();

  // Record startup time to avoid notifications for streams already live at launch
  chrome.storage.local.set({ startupTime: Date.now() }, () => {
    console.log("[INIT] Set startup time");
  });

  console.log("[INIT] Extension initialization complete.");
}

/**
 * Opens the extension's settings page in a new tab.
 */
function openSettingsPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/settings/settings.html") });
}

// --- Alarms ---

/**
 * Sets up the periodic alarm for fetching data using the simpler approach from the old version.
 * Always clears and recreates the alarm to ensure it's working properly.
 */
function setupAlarm() {
  console.log("[ALARM] Setting up alarm using simple approach from old version...");

  // Simple approach: always clear and recreate the alarm
  chrome.alarms.clear(FETCH_ALARM_NAME, () => {
    chrome.alarms.create(FETCH_ALARM_NAME, {
      periodInMinutes: FETCH_ALARM_PERIOD_MINUTES
    });
    console.log(`[ALARM] Created alarm '${FETCH_ALARM_NAME}' with period ${FETCH_ALARM_PERIOD_MINUTES} minutes (${FETCH_INTERVAL_SECONDS} seconds)`);
  });

  // Still verify the alarm was created correctly
  setTimeout(() => {
    chrome.alarms.get(FETCH_ALARM_NAME, (alarm) => {
      if (alarm) {
        console.log(`[ALARM] Verified alarm exists: ${alarm.name}, next fire: ${new Date(alarm.scheduledTime)}`);
      } else {
        console.error(`[ERROR] Failed to create alarm '${FETCH_ALARM_NAME}'! Trying again...`);
        chrome.alarms.create(FETCH_ALARM_NAME, {
          periodInMinutes: FETCH_ALARM_PERIOD_MINUTES
        });
      }
    });
  }, 1000); // Check after 1 second
}

/**
 * Opens the extension's settings page in a new tab.
 */
function openSettingsPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/settings/settings.html") });
}

// --- Fetch list function with enhanced logging ---
function fetchList() {
  console.log(`[FETCH] Starting fetchList at ${new Date().toISOString()}`);

  chrome.storage.local.get(["twitchAccessToken", "userId"], (result) => {
    if (result.twitchAccessToken && result.userId) {
      console.log(`[FETCH] Found credentials. User ID: ${result.userId.substring(0, 4)}...`);

      // First fetch user profile to check for avatar updates
      fetchUserProfileUpdates(result.twitchAccessToken);

      // Then continue with fetching follows
      fetchFollowList(result.twitchAccessToken, result.userId);
    } else {
      console.log("[FETCH] Access Token or User ID not found. Skipping fetch.");
    }
  });
}
// --- Authentication & User Profile ---

/**
 * Initiates the Twitch OAuth flow.
 * Handles browser differences for redirect URIs.
 */
function startOAuthFlow() {
  const isFirefox = typeof browser !== "undefined" && browser.runtime && browser.runtime.id;
  let redirectUri;

  if (isFirefox) {
    redirectUri = browser.identity.getRedirectURL();
  } else {
    redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
  }

  const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=user:read:follows`;

  const launchWebAuthFlow = isFirefox
    ? browser.identity.launchWebAuthFlow
    : chrome.identity.launchWebAuthFlow;

  launchWebAuthFlow(
    { url: authUrl, interactive: true },
    (redirectUrl) => {
      const lastError = isFirefox ? browser.runtime.lastError : chrome.runtime.lastError;
      if (lastError || !redirectUrl) {
        // Clear login in progress flag
        chrome.storage.local.remove("loginInProgress");
        console.error("OAuth flow failed:", lastError?.message || "No redirect URL received.");
        // Optionally send a message back to UI indicating failure
        chrome.runtime.sendMessage({ action: "oauthFailed", error: lastError?.message || "Unknown error" });
        return;
      }

      try {
        const url = new URL(redirectUrl);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");

        if (accessToken) {
          console.log("OAuth successful, access token obtained.");
          const storage = isFirefox ? browser.storage.local : chrome.storage.local;
          // Store token and immediately fetch profile/follows
          storage.set({ twitchAccessToken: accessToken, tokenExpired: false }, () => {
            console.log("Access token stored. Fetching user profile.");
            fetchUserProfile(accessToken); // Fetch profile to get user ID etc.
            // Note: fetchFollowList is called inside fetchUserProfile upon success
            // Send message to UI indicating success AFTER profile fetch (inside fetchUserProfile)
          });
        } else {
          console.error("OAuth flow completed but no access token found in redirect URL.", redirectUrl);
          chrome.runtime.sendMessage({ action: "oauthFailed", error: "Access token not found" });
        }
      } catch (error) {
        console.error("Error parsing redirect URL:", error, redirectUrl);
        chrome.runtime.sendMessage({ action: "oauthFailed", error: "Failed to parse redirect URL" });
      }
    }
  );
}

/**
 * Fetches the user's Twitch profile using the access token.
 * Stores user ID, avatar, and display name. Triggers follow list fetch on success.
 * @param {string} accessToken - The Twitch API access token.
 */
function fetchUserProfile(accessToken) {
  fetchWithRetry("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": TWITCH_CLIENT_ID,
    },
  })
    .then((data) => {
      if (data?.data?.length > 0) {
        const userProfile = data.data[0];
        const userId = userProfile.id;
        const userAvatar = userProfile.profile_image_url;
        const userDisplayName = userProfile.display_name;

        console.log(`User profile fetched: ${userDisplayName} (ID: ${userId})`);

        chrome.storage.local.set(
          {
            userId: userId,
            userAvatar: userAvatar,
            userDisplayName: userDisplayName,
            tokenExpired: false // Explicitly set token as valid
          },
          () => {
            console.log("User profile data stored. Fetching follow list.");
            fetchFollowList(accessToken, userId, true); // Pass true for isOAuthComplete
            // Don't send completion message *after* profile is successfully processed
            // chrome.runtime.sendMessage({ action: "oauthComplete" });
            notifyOAuthComplete();
          }
        );
      } else if (data === null) {
        // fetchWithRetry returns null on 401, handled there.
        console.log("fetchUserProfile: fetchWithRetry indicated token issue.");
      }
      else {
        console.error("Error fetching user profile: Invalid data received.", data);
        // Handle potential invalid token scenario even if not 401
        handleAuthenticationError();
      }
    })
    .catch((error) => {
      console.error("Error fetching user profile:", error);
      // Could be network error or other issue, potentially token related
      handleAuthenticationError();
    });
}

function notifyOAuthComplete() {
  // Just send the message and ignore errors
  chrome.runtime.sendMessage({ action: "oauthComplete" }, response => {
    if (chrome.runtime.lastError) {
      // Silently ignore the error - this is expected when popup is closed
      console.log("OAuth completed, but no listeners active. This is normal if settings page is closed.");
    }
  });
}

/**
 * Periodically fetches user profile to update avatar/display name if changed.
 * @param {string} accessToken - The Twitch API access token.
 */
function fetchUserProfileUpdates(accessToken) {
  fetchWithRetry("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": TWITCH_CLIENT_ID,
    },
  })
    .then((data) => {
      if (data?.data?.length > 0) {
        const userProfile = data.data[0];
        const userAvatar = userProfile.profile_image_url;
        const userDisplayName = userProfile.display_name;

        // Update storage only if needed (optional optimization)
        chrome.storage.local.get(["userAvatar", "userDisplayName"], (result) => {
          if (result.userAvatar !== userAvatar || result.userDisplayName !== userDisplayName) {
            console.log("User profile updated, saving changes.");
            chrome.storage.local.set({
              userAvatar: userAvatar,
              userDisplayName: userDisplayName,
            });
          } else {
            // console.log("User profile unchanged."); // Can be noisy
          }
        });
      } else if (data === null) {
        console.log("fetchUserProfileUpdates: fetchWithRetry indicated token issue.");
      }
      else {
        console.warn("Could not update user profile: Invalid data received.", data);
      }
    })
    .catch((error) => {
      console.error("Error updating user profile:", error);
      // Consider if this warrants calling handleAuthenticationError() as well
    });
}


/**
 * Handles common tasks when an authentication error (like 401) occurs.
 * Clears token, sets expired flag, updates badge, potentially notifies UI.
 */
function handleAuthenticationError() {
  console.warn("Handling authentication error (likely expired token).");
  chrome.storage.local.remove(["twitchAccessToken", "userId", "userAvatar", "userDisplayName"], () => {
    chrome.storage.local.set({ tokenExpired: true, liveStreams: [], liveStreamCount: 0 }, () => {
      updateBadge(); // Clear the badge
      // Optionally notify UI pages that user needs to re-authenticate
      chrome.runtime.sendMessage({ action: "authError" }).catch(e => console.log("No UI listener for authError"));;
      console.log("Cleared authentication token and related user data due to error.");
    });
  });
}

// --- Twitch Data Fetching (Follows & Streams) ---


/**
 * Recursively fetches all followed channels for a user.
 * Uses pagination cursor. Saves the complete list to storage.
 * @param {string} accessToken - Twitch API access token.
 * @param {string} userId - Twitch user ID.
 * @param {boolean} [isOAuthComplete=false] - Flag indicating if this fetch is part of the initial OAuth flow.
 * @param {string} [cursor=""] - Pagination cursor for fetching next page.
 * @param {Array} [followedList=[]] - Accumulated list of followed channels.
 */
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

  fetchWithRetry(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-ID": TWITCH_CLIENT_ID,
    },
  })
    .then((data) => {
      if (data === null) { // Token likely expired (handled in fetchWithRetry)
        console.log("fetchFollowList: fetchWithRetry indicated token issue.");
        if (isOAuthComplete) {
          // If this happened during initial OAuth, signal a problem
          chrome.runtime.sendMessage({ action: "oauthFailed", error: "Failed to fetch follows after auth" });
        }
        return;
      }

      followedList = followedList.concat(data.data || []);

      if (data.pagination?.cursor) {
        // Fetch next page
        fetchFollowList(
          accessToken,
          userId,
          isOAuthComplete,
          data.pagination.cursor,
          followedList
        );
      } else {
        // All pages fetched
        console.log(`Fetched all ${followedList.length} followed channels.`);
        chrome.storage.local.set({ followedList: followedList }, () => {
          console.log("Followed list saved. Fetching stream data.");
          fetchStreamData(accessToken, followedList);
          // Note: oauthComplete message is sent earlier in fetchUserProfile now
        });
      }
    })
    .catch((error) => {
      console.error("Error fetching follow list (final attempt failed):", error);
      // If this fails during OAuth, it's a problem
      if (isOAuthComplete) {
        chrome.runtime.sendMessage({ action: "oauthFailed", error: "Failed to fetch follows after auth" });
      }
    });
}

/**
 * Fetches live stream status for all followed channels.
 * Also fetches category and user data (for avatars) for live streams.
 * Updates storage with live stream info and triggers notifications/badge update.
 * @param {string} accessToken - Twitch API access token.
 * @param {Array} followedList - List of followed channel objects.
 */
function fetchStreamData(accessToken, followedList) {
  if (!followedList || followedList.length === 0) {
    console.log("No followed channels to fetch stream data for.");
    // Ensure live streams are cleared in storage if the follow list is empty
    chrome.storage.local.set({ liveStreams: [], liveStreamCount: 0 }, updateBadge);
    return;
  }

  // Create batches of user_logins (max 100 per request)
  const batchSize = 100;
  const streamFetchPromises = [];

  for (let i = 0; i < followedList.length; i += batchSize) {
    const batch = followedList.slice(i, i + batchSize);
    const userLogins = batch.map(channel => `user_login=${channel.broadcaster_login}`).join('&');
    if (!userLogins) continue; // Skip empty batches

    const streamUrl = `https://api.twitch.tv/helix/streams?${userLogins}&first=${batchSize}`;
    streamFetchPromises.push(
      fetchWithRetry(streamUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": TWITCH_CLIENT_ID }
      })
    );
  }

  Promise.all(streamFetchPromises)
    .then(results => {
      // Combine results from all batches
      let liveStreamData = [];
      results.forEach(data => {
        if (data?.data) {
          liveStreamData = liveStreamData.concat(data.data);
        } else if (data === null) {
          console.log("fetchStreamData: fetchWithRetry indicated token issue during batch fetch.");
          // Don't stop processing other batches, but token is likely bad.
        }
      });

      if (!liveStreamData || liveStreamData.length === 0) {
        console.log("No streams are live.");
        chrome.storage.local.set({ liveStreams: [], liveStreamCount: 0 }, () => {
          updateBadge();
          // Clear last known streams if nothing is live now
          chrome.storage.local.set({ lastKnownLiveStreams: {} });
        });
        return;
      }

      console.log(`Found ${liveStreamData.length} live streams initially.`);

      // Fetch additional details (category, avatar) for live streams
      // Batch game IDs and user IDs for efficiency
      const gameIds = [...new Set(liveStreamData.map(s => s.game_id).filter(id => id && id !== "0"))]; // Filter out empty/zero IDs
      const userIds = [...new Set(liveStreamData.map(s => s.user_id).filter(id => id))]; // Ensure user_id exists

      const fetchDetailsPromises = [];

      // Fetch categories by game IDs (batching)
      if (gameIds.length > 0) {
        const gameBatches = [];
        for (let i = 0; i < gameIds.length; i += 100) {
          gameBatches.push(gameIds.slice(i, i + 100));
        }
        gameBatches.forEach(batch => {
          const categoryUrl = `https://api.twitch.tv/helix/games?${batch.map(id => `id=${id}`).join('&')}`;
          fetchDetailsPromises.push(
            fetchWithRetry(categoryUrl, { headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": TWITCH_CLIENT_ID } })
              .then(data => ({ type: 'games', data: data?.data || [] }))
              .catch(err => { console.error("Error fetching game batch:", err); return { type: 'games', data: [] }; }) // Allow partial success
          );
        });
      } else {
        fetchDetailsPromises.push(Promise.resolve({ type: 'games', data: [] })); // Ensure promise exists
      }


      // Fetch user profiles by user IDs (batching, primarily for avatars)
      if (userIds.length > 0) {
        const userBatches = [];
        for (let i = 0; i < userIds.length; i += 100) {
          userBatches.push(userIds.slice(i, i + 100));
        }
        userBatches.forEach(batch => {
          const userUrl = `https://api.twitch.tv/helix/users?${batch.map(id => `id=${id}`).join('&')}`;
          fetchDetailsPromises.push(
            fetchWithRetry(userUrl, { headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": TWITCH_CLIENT_ID } })
              .then(data => ({ type: 'users', data: data?.data || [] }))
              .catch(err => { console.error("Error fetching user batch:", err); return { type: 'users', data: [] }; }) // Allow partial success
          );
        });
      } else {
        fetchDetailsPromises.push(Promise.resolve({ type: 'users', data: [] })); // Ensure promise exists
      }

      return Promise.all(fetchDetailsPromises).then(detailResults => {
        const gameDataMap = new Map();
        const userDataMap = new Map();

        detailResults.forEach(result => {
          if (result.type === 'games') {
            result.data.forEach(game => gameDataMap.set(game.id, game.name));
          } else if (result.type === 'users') {
            result.data.forEach(user => userDataMap.set(user.id, user.profile_image_url));
          }
        });

        // Now, combine stream data with fetched details
        const enrichedLiveStreams = liveStreamData.map(stream => {
          const thumbnailUrl = stream.thumbnail_url
            .replace('{width}', '320')
            .replace('{height}', '180');
          const categoryName = gameDataMap.get(stream.game_id) || 'Unknown Category';
          const avatarUrl = userDataMap.get(stream.user_id) || "../../css/twitch.png"; // Provide a default

          return {
            broadcasterLogin: stream.user_login,
            channelName: stream.user_name, // Use user_name from stream endpoint
            title: stream.title,
            viewers: stream.viewer_count,
            category: categoryName,
            avatar: avatarUrl,
            thumbnail: thumbnailUrl,
            live: true,
            started_at: stream.started_at,
            type: stream.type // e.g., "live"
          };
        }).filter(stream => stream !== null); // Filter out any potential nulls if error handling was different

        processLiveStreams(enrichedLiveStreams); // Process for notifications and storage
      });

    })
    .catch(error => {
      console.error("Error fetching stream data:", error);
      // Clear live streams in storage on catastrophic failure? Maybe not, could be temporary.
      // chrome.storage.local.set({ liveStreams: [], liveStreamCount: 0 }, updateBadge);
    });
}


/**
 * Processes the fetched live streams: updates storage, checks for new streams,
 * sends notifications, and updates the badge.
 * @param {Array} liveStreams - Array of processed live stream objects.
 */
function processLiveStreams(liveStreams) {
  chrome.storage.local.get(
    {
      lastKnownLiveStreams: {},
      startupTime: 0,
      enableNotifications: false, // Default off
      selectedChannels: [],
      showBadge: true, // Default on
      // No need to get liveStreamCount here, we are setting it
    },
    (result) => {
      let lastKnownLiveStreams = result.lastKnownLiveStreams || {};
      const startupTime = result.startupTime || 0;
      const enableNotifications = result.enableNotifications;
      const selectedChannels = result.selectedChannels || [];
      // showBadge is used by updateBadge, not directly here
      const currentTime = Date.now();
      const newLiveStreams = {}; // Track streams that just went live in *this* cycle

      // Determine newly live streams for notifications
      liveStreams.forEach((stream) => {
        const channelId = stream.channelName; // Use channelName as the key
        const wasLive = lastKnownLiveStreams[channelId]; // Check if it was live in the *previous* cycle

        // Conditions for notification:
        // 1. Stream is live.
        // 2. It was NOT live in the last check OR lastKnown map is empty/missing entry (first run after install/clear).
        // 3. Enough time has passed since extension startup to avoid flood.
        // 4. Notifications are globally enabled.
        // 5. EITHER no specific channels are selected (notify all) OR this channel IS selected.
        if (
          stream.live &&
          !wasLive &&
          currentTime - startupTime > NEW_STREAM_NOTIFICATION_DELAY_MS &&
          enableNotifications &&
          (selectedChannels.length === 0 || selectedChannels.includes(channelId))
        ) {
          console.log(`Sending notification for ${channelId} (wasLive: ${wasLive})`);
          sendLiveNotification(stream);
        }

        // Update the map for the *next* cycle's check
        if (stream.live) {
          newLiveStreams[channelId] = true; // Mark as live *now*
        }
        // No need for an else; if it's not live, it won't be in newLiveStreams
      });

      // Save the latest live stream data and the updated map of currently live streams
      chrome.storage.local.set(
        {
          liveStreams: liveStreams,
          liveStreamCount: liveStreams.length,
          lastKnownLiveStreams: newLiveStreams, // Save the state from *this* fetch
        },
        () => {
          updateBadge(); // Update badge based on the new count and settings
          console.log(`Processed ${liveStreams.length} live streams. Updated storage and badge.`);
        }
      );
    }
  );
}


// --- API Utilities ---

/**
 * Wrapper around fetch with exponential backoff retry logic for specific errors (429, other HTTP errors).
 * Handles 401 Unauthorized by clearing the token and returning null.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options (headers, etc.).
 * @param {number} [maxRetries=3] - Maximum number of retries.
 * @param {number} [initialDelay=1000] - Initial delay in ms before first retry.
 * @returns {Promise<object|null>} - Resolves with the JSON response data, or null if auth failed (401). Rejects on other persistent errors.
 */
function fetchWithRetry(url, options, maxRetries = 3, initialDelay = 1000) {
  return new Promise((resolve, reject) => {
    const attemptFetch = (retriesLeft, delay) => {
      fetch(url, options)
        .then(response => {
          if (response.status === 401) {
            console.warn(`Authorization error (401) fetching ${url}. Token likely expired or invalid.`);
            handleAuthenticationError(); // Centralized handler
            resolve(null); // Resolve with null to indicate auth failure upstream
            return; // Stop processing this fetch
          }
          if (response.status === 429) { // Rate Limited
            if (retriesLeft > 0) {
              const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10) * 1000;
              const waitTime = Math.max(retryAfter, delay); // Use Retry-After if available, otherwise backoff
              console.log(`Rate limited (429) on ${url}. Retrying in ${waitTime}ms. Retries left: ${retriesLeft}`);
              setTimeout(() => attemptFetch(retriesLeft - 1, delay * 2), waitTime);
            } else {
              console.error(`RATE LIMIT EXCEEDED after all retries for ${url}.`);
              handleRateLimitExceeded(url); // Notify UI/log details
              resolve({ data: [], pagination: {} }); // Resolve with empty data to prevent breaking callers expecting an object
            }
            return; // Stop processing this response further
          }
          if (!response.ok) { // Other HTTP errors (e.g., 500, 404)
            console.error(`HTTP error ${response.status}: ${response.statusText} for ${url}`);
            if (retriesLeft > 0 && response.status >= 500) { // Only retry server errors
              console.log(`Retrying in ${delay}ms due to server error. Retries left: ${retriesLeft}`);
              setTimeout(() => attemptFetch(retriesLeft - 1, delay * 2), delay);
            } else {
              // Don't retry client errors (4xx) other than 401/429, or if retries exhausted
              reject(new Error(`HTTP error ${response.status}: ${response.statusText} after ${maxRetries - retriesLeft} retries for ${url}`));
            }
            return; // Stop processing this response further
          }

          // Successful response
          // Reset rate limit flag if we succeed after potentially hitting it
          chrome.storage.local.get("rateLimitHit", (result) => {
            if (result.rateLimitHit) {
              chrome.storage.local.remove(["rateLimitHit", "rateLimitTimestamp", "rateLimitDetails"]);
              console.log("Successfully fetched data after previous rate limit.");
              // Notify UI that rate limit seems resolved
              chrome.runtime.sendMessage({ action: "rateLimitResolved" }).catch(e => console.log("No UI listener for rateLimitResolved"));;
            }
          });
          resolve(response.json()); // Parse JSON and resolve the promise

        })
        .catch(error => { // Network errors or fetch API errors
          console.error(`Network error fetching ${url}: ${error.message}`);
          if (retriesLeft > 0) {
            console.log(`Retrying in ${delay}ms due to network error. Retries left: ${retriesLeft}`);
            setTimeout(() => attemptFetch(retriesLeft - 1, delay * 2), delay);
          } else {
            console.error(`Failed to fetch ${url} after ${maxRetries} retries due to network/fetch error.`);
            reject(error); // Reject after all retries fail
          }
        });
    };

    attemptFetch(maxRetries, initialDelay);
  });
}

/**
 * Handles the situation when rate limiting persists after all retries.
 * Stores details and sends a message to the UI, applying a cooldown.
 * @param {string} url - The URL that hit the rate limit.
 */
function handleRateLimitExceeded(url) {
  let endpoint = 'unknown';
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    if (path.includes('/helix/channels/followed')) endpoint = 'followed channels';
    else if (path.includes('/helix/games')) endpoint = 'game info';
    else if (path.includes('/helix/users')) endpoint = 'user info';
    else if (path.includes('/helix/streams')) endpoint = 'stream status';
  } catch (e) { /* ignore parsing error */ }

  const channel = url.includes('user_login=') ? url.split('user_login=')[1]?.split('&')[0] : 'N/A';

  chrome.storage.local.get(['lastRateLimitNotification'], (data) => {
    const now = Date.now();
    const lastNotification = data.lastRateLimitNotification || 0;

    if (now - lastNotification > RATE_LIMIT_NOTIFICATION_COOLDOWN_MS) {
      console.log(`Persistent rate limit detected for endpoint: ${endpoint}. Notifying UI.`);
      const rateLimitDetails = { channel: channel, endpoint: endpoint, timestamp: now };
      chrome.storage.local.set({
        rateLimitHit: true,
        rateLimitTimestamp: now,
        lastRateLimitNotification: now,
        rateLimitDetails: rateLimitDetails
      }, () => {
        // Send message to potentially update UI
        chrome.runtime.sendMessage({ action: "rateLimitHit", details: rateLimitDetails })
          .catch(e => console.log("No UI listener for rateLimitHit")); // Catch error if no UI is open
      });
    } else {
      // Rate limit still active, but cooldown prevents repeated notifications. Just update timestamp.
      console.log(`Persistent rate limit ongoing for endpoint: ${endpoint}. Cooldown active.`);
      chrome.storage.local.set({ rateLimitHit: true, rateLimitTimestamp: now });
    }
  });
}


// --- Badge Management ---

/**
 * Updates the extension badge count and color based on stored live stream count and user settings.
 */
async function updateBadge() {
  // Use async/await for cleaner storage access
  try {
    const settings = await chrome.storage.local.get(["showBadge", "liveStreamCount", "badgeColor", "tokenExpired"]);
    const showBadge = settings.showBadge !== undefined ? settings.showBadge : true; // Default true
    const liveCount = settings.liveStreamCount || 0;
    const badgeColor = settings.badgeColor || "#6366f1"; // Default color indigo-500/600
    const tokenExpired = settings.tokenExpired || false;

    let badgeText = "";
    let title = "Twitch Live Channels"; // Default title

    if (tokenExpired) {
      badgeText = "!"; // Indicate error/auth needed
      title = "Twitch token expired! Click to re-authenticate.";
    } else if (showBadge && liveCount > 0) {
      badgeText = String(liveCount);
      title = `${liveCount} followed channel(s) are live!`;
    } else if (showBadge && liveCount === 0) {
      badgeText = "0"; // Explicitly show 0 if badge is enabled but none live
      title = "No followed channels are live.";
    } else {
      // Badge disabled or count is 0 and badge is enabled
      badgeText = "";
      title = liveCount === 0 ? "No followed channels are live." : "Twitch Live Channels (Badge Disabled)";
    }

    // Set badge text
    await chrome.action.setBadgeText({ text: badgeText });

    // Set badge background color only if there's text
    if (badgeText) {
      await chrome.action.setBadgeBackgroundColor({ color: tokenExpired ? "#DC2626" : badgeColor }); // Red for error, user color otherwise
    }

    // Set tooltip (title)
    await chrome.action.setTitle({ title: title });

  } catch (error) {
    console.error("Error updating badge:", error);
  }
}

// --- Notifications ---

/**
 * Sends a desktop notification that a channel has gone live.
 * @param {object} stream - The stream object containing channel details.
 */
function sendLiveNotification(stream) {
  // Re-check global notification setting just before sending (might have changed)
  chrome.storage.local.get(['enableNotifications', 'selectedChannels'], (settings) => {
    if (!settings.enableNotifications) return;

    const selectedChannels = settings.selectedChannels || [];
    // Final check: Is this specific channel allowed to notify?
    if (selectedChannels.length > 0 && !selectedChannels.includes(stream.channelName)) {
      // console.log(`Notification skipped for ${stream.channelName} (not in selected list).`);
      return;
    }

    const notificationId = "liveNotification_" + stream.channelName; // Unique ID per channel
    chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: stream.avatar || "../../css/twitch.png", // Use a local fallback
      title: `${stream.channelName} is live!`,
      message: `${stream.title}\nStreaming: ${stream.category}`, // Include title and category
      priority: 1, // 0 to 2; 1 is default-ish, 2 is high
      // Optional: Add buttons if needed later
      // buttons: [{ title: "Watch Now" }]
    });
    console.log(`Sent notification for ${stream.channelName}`);

    // Optional: Add listener for notification clicks if buttons are added
    // chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => { ... });
    // chrome.notifications.onClicked.addListener(notifId => { ... });
  });
}

// --- Context Menus ---

/**
 * Creates the right-click context menu items for the extension action icon.
 */
function createContextMenuItems() {
  // Remove all existing items first to prevent duplicates on reload
  chrome.contextMenus.removeAll(() => {
    // Use chrome.action for Manifest V3
    chrome.contextMenus.create({
      id: "openSettings",
      title: "Open Settings",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "disconnectTwitch",
      title: "Disconnect Twitch Account",
      contexts: ["action"],
    });
    console.log("Context menu items created.");
  });
}

// Listener for context menu item clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "disconnectTwitch") {
    console.log("Context menu: Disconnect Twitch requested.");
    disconnectTwitchAccount();
  } else if (info.menuItemId === "openSettings") {
    console.log("Context menu: Open Settings requested.");
    openSettingsPage();
  }
});

/**
 * Handles the process of disconnecting the Twitch account.
 * Clears relevant storage and resets the badge.
 * @param {function} [sendResponse] - Optional response callback for message passing.
 */
function disconnectTwitchAccount(sendResponse) {
  const isFirefox = typeof browser !== "undefined" && browser.runtime && browser.runtime.id;
  const storage = isFirefox ? browser.storage.local : chrome.storage.local;

  storage.remove(
    [
      "twitchAccessToken",
      "followedList",
      "liveStreams",
      "userId",
      "userAvatar",
      "userDisplayName",
      "lastKnownLiveStreams", // Also clear notification state
      "liveStreamCount",
      "tokenExpired" // Clear expired flag too
    ],
    () => {
      console.log("Twitch account disconnected, cleared relevant storage.");
      chrome.action.setBadgeText({ text: "" }); // Clear badge immediately
      chrome.action.setTitle({ title: "Twitch Live Channels (Not Connected)" }); // Update title
      // Stop the alarm if running, as there's no token to fetch with
      chrome.alarms.clear(FETCH_ALARM_NAME);
      console.log(`Cleared alarm '${FETCH_ALARM_NAME}' due to disconnect.`);

      if (sendResponse) {
        sendResponse({ status: "success" });
      }
      // Send a general message that might update UI elements
      chrome.runtime.sendMessage({ action: "disconnected" }).catch(e => console.log("No UI listener for disconnected"));;
    }
  );
}

// --- Message Handling ---

// Central listener for messages from other parts of the extension (popup, settings)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.action, message); // Log received messages

  switch (message.action) {
    case "startOAuth":
      console.log("Received 'startOAuth' message.");
      startOAuthFlow();
      // OAuth flow is async, response is handled via separate messages ('oauthComplete'/'oauthFailed')
      // No immediate response needed here, so don't return true.
      break;

    case "disconnectTwitch":
      console.log("Received 'disconnectTwitch' message.");
      disconnectTwitchAccount(sendResponse);
      return true; // Indicate asynchronous response

    case "updateBadgeState":
      console.log("Received 'updateBadgeState' message:", message.showBadge, message.badgeColor);
      chrome.storage.local.set({
        showBadge: message.showBadge,
        badgeColor: message.badgeColor
      }, () => {
        updateBadge(); // Update badge immediately with new settings
        sendResponse({ status: "Badge state updated" });
      });
      return true; // Indicate asynchronous response

    case "forceFetch":
      console.log("Received 'forceFetch' message.");
      fetchList(); // Trigger a manual refresh
      sendResponse({ status: "Fetch triggered" });
      break;

    case "getInitialData": // Send necessary initial data to UI on request
      console.log("Received 'getInitialData' message.");
      chrome.storage.local.get([
        "twitchAccessToken",
        "userDisplayName",
        "userAvatar",
        "liveStreams",
        "liveStreamCount",
        "enableNotifications",
        "selectedChannels",
        "showBadge",
        "badgeColor",
        "followedList", // Send followed list for settings page
        "tokenExpired",
        "rateLimitHit",
        "rateLimitDetails",
        "rateLimitTimestamp"
      ], (data) => {
        sendResponse(data);
      });
      return true; // Indicate asynchronous response
    default:
      console.log("Received unknown message action:", message.action);
      // Optionally send a response for unhandled messages
      // sendResponse({ status: "error", message: "Unknown action" });
      break;
  }

  // Return false explicitly if not sending an async response (or let it be undefined)
  // Returning true is only needed if sendResponse will be called later.
  return false; // Default for synchronous handling or no response needed
});

// Important: listener to respond when the alarm fires
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FETCH_ALARM_NAME) {
    console.log(`[ALARM] Alarm fired at ${new Date().toISOString()}`);
    fetchList();
  }
});

console.log("Background script loaded and listeners attached.");