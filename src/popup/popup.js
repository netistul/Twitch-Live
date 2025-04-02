// --- popup.js ---

// Global flag to prevent multiple simultaneous updates if needed
let isUpdatingStreams = false;

// --- Event Listeners & Initialization ---
document.addEventListener("DOMContentLoaded", function () {
  // Apply theme ASAP
  applyDarkMode(); // Defined in ui.js

  // Initialize non-dynamic UI elements (like settings icon listeners)
  initializeUI(); // Defined in ui.js

  // Update live streams immediately
  triggerUpdateLiveStreams();

  // Delay checking login status slightly
  setTimeout(checkLoginAndDisplayAppropriateUI, 100);

  // Set interval for updates
  setInterval(function () {
    triggerUpdateLiveStreams();
    // Re-check login status periodically in case token expires
    setTimeout(checkLoginAndDisplayAppropriateUI, 100);
  }, 30000); // 30 seconds

  // Rate limit check (assuming this function exists elsewhere)
  setTimeout(initRateLimitCheck, 1000);

  // Listener for OAuth completion from background script
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "oauthComplete") {
      console.log("OAuth complete message received in popup.");
      applyDarkMode(); // Re-apply theme if needed
      hideSpinner(); // Hide spinner if it was shown (ui.js)

      // Fetch streams immediately after login
      triggerUpdateLiveStreams();

      // Optional: Force refresh a few times shortly after login
      let refreshCount = 0;
      const refreshInterval = setInterval(() => {
        if (refreshCount < 3) { // e.g., refresh 3 times over 1.5s
          triggerUpdateLiveStreams();
          refreshCount++;
        } else {
          clearInterval(refreshInterval);
        }
      }, 500); // Refresh every 500ms

      // Clear any session expired flag
      chrome.storage.local.remove("tokenExpired");
    }
    // Handle other messages if necessary
  });
});


// --- Logic Functions ---

function checkLoginAndDisplayAppropriateUI() {
  chrome.storage.local.get(
    ["twitchAccessToken", "tokenExpired"],
    function (result) {
      if (!result.twitchAccessToken) {
        console.log("No access token found, displaying login button.");
        // Call the UI function to show the login screen
        displayLoginButton(result.tokenExpired || false); // Pass expiry status to UI function (ui.js)
        // Clear any potentially displayed streams from previous state
        // const container = document.getElementById("buttonContainer");
        // if (container) container.innerHTML = ''; // displayLoginButton already clears it
      } else {
        console.log("Access token found, updating live streams.");
        // Token exists, proceed to update streams (if not already updating)
        triggerUpdateLiveStreams();
      }
    }
  );
}

// Renamed from updateLiveStreams to avoid confusion with the UI function
function triggerUpdateLiveStreams() {
  if (isUpdatingStreams) {
    console.log("Stream update already in progress.");
    return; // Prevent concurrent updates
  }

  isUpdatingStreams = true;
  console.log("Triggering live stream update...");

  // Fetch all necessary data from storage
  chrome.storage.local.get(
    [
      "twitchAccessToken", // Check if logged in before fetching streams
      "liveStreams",
      "favoriteGroups",
      "showAvatar",
      "channelAccess",
      "hideAccessedCount",
      "streamGrouping",
      "showStreamTime",
      "streamTitleDisplay",
    ],
    function (result) {
      // Only proceed if logged in
      if (!result.twitchAccessToken) {
        console.log("Not logged in, skipping stream update trigger.");
        isUpdatingStreams = false;
        checkLoginAndDisplayAppropriateUI(); // Show login if token disappeared
        return;
      }

      // Prepare data object for the UI function
      const streamsData = {
        liveStreams: result.liveStreams || [],
        favoriteGroups: result.favoriteGroups || [],
        showAvatar: result.showAvatar !== undefined ? result.showAvatar : true,
        channelAccess: result.channelAccess || {},
        hideAccessedCount: result.hideAccessedCount !== undefined ? result.hideAccessedCount : false,
        streamGrouping: result.streamGrouping || "none",
        showStreamTime: result.showStreamTime === "on", // Convert 'on'/'off' to boolean
        streamTitleDisplay: result.streamTitleDisplay || "hover",
      };

      // Call the UI function from ui.js to update the display
      updateLiveStreams(streamsData); // Defined in ui.js

      isUpdatingStreams = false; // Allow next update
    }
  );
}

function incrementChannelAccess(broadcasterLogin) {
  console.log(`Incrementing access count for ${broadcasterLogin}`);
  chrome.storage.local.get(["channelAccess"], function (result) {
    let channelAccess = result.channelAccess || {};
    channelAccess[broadcasterLogin] = (channelAccess[broadcasterLogin] || 0) + 1;
    chrome.storage.local.set({ channelAccess: channelAccess }, () => {
      console.log(`Access count for ${broadcasterLogin} updated to ${channelAccess[broadcasterLogin]}`);
      // Optional: Trigger a UI refresh immediately if sorting might change noticeably
      // triggerUpdateLiveStreams(); // Be careful of update loops if called too often
    });
  });
}

// --- UI Event Handlers (Called by listeners set up in ui.js) ---

function handleLoginClick() {
  console.log("Login button clicked.");
  const buttonContainer = document.getElementById("buttonContainer");
  // Show spinner (managed by ui.js function)
  if (buttonContainer) {
    showSpinner(buttonContainer); // Defined in ui.js
  }
  // Send message to background script to start OAuth flow
  chrome.runtime.sendMessage({ action: "startOAuth" });
}

function handleSettingsClick() {
  console.log("Settings icon clicked.");
  // Define popup window properties
  const screenWidth = 700;
  // Ensure height doesn't exceed available screen height
  const screenHeight = Math.min(window.screen.availHeight, 880);
  // Open the settings page
  window.open(
    "../settings/settings.html",
    "ExtensionSettings", // Window name
    `width=${screenWidth},height=${screenHeight},resizable=yes,scrollbars=yes` // Added resizable/scrollbars
  );
}

function handleStreamLinkClick(broadcasterLogin, url) {
  console.log(`Stream link clicked for ${broadcasterLogin}`);
  // Increment access count first
  incrementChannelAccess(broadcasterLogin);
  // Then open the link (use setTimeout to ensure storage write likely completes)
  setTimeout(() => {
    window.open(url, "_blank");
  }, 50); // Small delay
}