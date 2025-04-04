// --- popup.js ---

// --- Helper Function ---
function showDynamicContent() {
  if (initialPlaceholder) initialPlaceholder.style.display = 'none';
  if (dynamicContentContainer) dynamicContentContainer.style.display = 'block'; // Or 'flex' etc. if needed
}

// Global flag to prevent multiple simultaneous updates if needed
let isUpdatingStreams = false; // Make sure this is defined at the top level

let isFirstStreamLoad = true;

// Flag to detect if we need to actively poll for auth completion
let activeAuthCheck = false;
let noStreamsShowing = false;

let streamCheckInterval = null;
// --- DOMContentLoaded event handler ---
document.addEventListener("DOMContentLoaded", function () {
  console.log("[DEBUG] Popup opened");

  // Apply theme ASAP - MOST IMPORTANT STEP FOR INSTANT THEME
  applyDarkMode(); // Defined in ui.js

  // Get element references now that DOM is loaded
  initialPlaceholder = document.getElementById('initialPlaceholder');
  dynamicContentContainer = document.getElementById('dynamicContentContainer');

  // *** Static placeholder is already visible via HTML/CSS ***
  // *** Theme is applied above ***

  // Initialize non-dynamic UI elements (like settings icon listeners)
  initializeUI(); // Defined in ui.js

  // --- Start loading dynamic content ---

  // Check login status fairly quickly to decide what to show
  // This function will eventually call showDynamicContent()
  checkLoginAndDisplayAppropriateUI();

  // Add monitoring for empty stream list
  // This will check for "No followed channels are currently live" or "Checking for live channels..."
  // and trigger a refresh if needed

  // Begin active polling for live streams if loading/empty
  setTimeout(startActiveStreamPolling, 500);

  // Only run this special check for 30 seconds after popup opens
  // This is the failsafe timeout
  setTimeout(() => {
    // CHECK if the interval exists before clearing
    if (streamCheckInterval) {
      clearInterval(streamCheckInterval);
      streamCheckInterval = null; // Optional: Reset the variable state
      console.log("[DEBUG] Disabling special content check via DOMContentLoaded failsafe timeout");
    } else {
      console.log("[DEBUG] Failsafe timeout: No active stream check interval to clear.");
    }
  }, 30000); // 30 seconds

  // Rate limit check
  setTimeout(initRateLimitCheck, 1000); // Assuming this doesn't need login

  // Listener for OAuth completion from background script
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "oauthComplete") {
      console.log("[DEBUG] OAuth complete message received in popup.");
      applyDarkMode(); // Re-apply theme if needed

      isFirstStreamLoad = true; // Reset first load flag

      // Check login which will trigger stream fetch
      checkLoginAndDisplayAppropriateUI();

      // Force refresh a few times shortly after login
      let refreshCount = 0;
      const refreshInterval = setInterval(() => {
        if (refreshCount < 3) {
          console.log(`[DEBUG] Forced refresh #${refreshCount + 1} after auth`);
          triggerUpdateLiveStreams(); // Updates dynamic content
          refreshCount++;
        } else {
          clearInterval(refreshInterval);
        }
      }, 1000); // Do this more quickly - every second

      chrome.storage.local.remove("tokenExpired");
    }
    // Handle other messages if necessary
  });
});

function startActiveStreamPolling() {
  // Clear any *previous* interval if popup is reopened quickly
  if (streamCheckInterval) {
    clearInterval(streamCheckInterval);
    console.log("[DEBUG] Cleared previous stream check interval.");
  }

  let activeEmptyCheckCount = 0;
  const maxEmptyChecks = 10;

  // Assign to the outer variable - REMOVE 'const'
  streamCheckInterval = setInterval(function () { // <--- ASSIGN HERE
    if (!dynamicContentContainer) {
      clearInterval(streamCheckInterval); // Clear using the outer variable
      streamCheckInterval = null;
      return;
    }

    const content = dynamicContentContainer.innerText;
    console.log("[DEBUG] Checking dynamic content:", content);

    const isLoadingMessage = content.includes("Checking for live channels...");
    const isEmptyMessage = content.includes("No followed channels are currently live");

    if ((isLoadingMessage || isEmptyMessage) && activeEmptyCheckCount < maxEmptyChecks) {
      activeEmptyCheckCount++;
      console.log(`[DEBUG] Empty or loading state detected (check ${activeEmptyCheckCount}/${maxEmptyChecks})`);

      chrome.storage.local.get("twitchAccessToken", function (result) {
        if (result.twitchAccessToken) {
          console.log("[DEBUG] We have token, retrying stream update...");
          triggerUpdateLiveStreams();
        }
      });
    } else {
      console.log("[DEBUG] Streams loaded or max retries hit. Clearing interval.");
      clearInterval(streamCheckInterval); // Clear using the outer variable
      streamCheckInterval = null; // Reset the outer variable
    }
  }, 2000); // Check every 2 seconds

  console.log("[DEBUG] Started active stream polling interval:", streamCheckInterval);

  // This timeout *also* needs to clear the outer variable
  // It might even be redundant now, consider removing one of the 30s timeouts if they do the same thing.
  setTimeout(() => {
    if (streamCheckInterval) { // Check if it still exists
      clearInterval(streamCheckInterval);
      streamCheckInterval = null; // Reset the outer variable
      console.log("[DEBUG] Disabling special content check via startActiveStreamPolling's timeout");
    }
  }, 30000);
}

// --- Logic Functions ---

function checkLoginAndDisplayAppropriateUI() {
  chrome.storage.local.get(
    ["twitchAccessToken", "tokenExpired"],
    function (result) {
      // Ensure dynamicContentContainer reference is available
      if (!dynamicContentContainer) dynamicContentContainer = document.getElementById('dynamicContentContainer');

      if (chrome.runtime.lastError) {
        console.error("Error checking login status:", chrome.runtime.lastError);
        // Display error in the dynamic content area
        if (dynamicContentContainer) {
          dynamicContentContainer.innerHTML = "<div style='padding: 20px; text-align: center; color: red;'>Error loading data.</div>";
          showDynamicContent(); // Show the error area instead of placeholder
        }
        return;
      }

      // *** Prepare to switch from placeholder to dynamic content ***
      showDynamicContent(); // Hide placeholder, show dynamic container

      if (!result.twitchAccessToken) {
        console.log("No access token found, displaying login button.");
        // Call the UI function to show the login screen IN THE DYNAMIC CONTAINER
        displayLoginButton(result.tokenExpired || false); // Pass expiry status to UI function (ui.js)
      } else {
        console.log("Access token found, updating live streams.");
        // Token exists, proceed to update streams (if not already updating)
        // This will populate the dynamic container
        triggerUpdateLiveStreams();
      }
    }
  );
}

// Renamed from updateLiveStreams to avoid confusion with the UI function
function triggerUpdateLiveStreams() {
  // Ensure dynamic container is visible (might be redundant but safe)
  showDynamicContent();
  // Ensure dynamicContentContainer reference is available
  if (!dynamicContentContainer) dynamicContentContainer = document.getElementById('dynamicContentContainer');

  if (isUpdatingStreams) {
    console.log("[DEBUG] Stream update already in progress.");
    return; // Prevent concurrent updates
  }

  isUpdatingStreams = true;
  console.log("[DEBUG] Triggering live stream update...");

  chrome.storage.local.get(
    [
      "twitchAccessToken", "liveStreams", "favoriteGroups", "showAvatar",
      "channelAccess", "hideAccessedCount", "streamGrouping", "showStreamTime",
      "streamTitleDisplay",
    ],
    function (result) {
      isUpdatingStreams = false;

      if (chrome.runtime.lastError) {
        console.error("[DEBUG] Error fetching data for stream update:", chrome.runtime.lastError);
        if (dynamicContentContainer && !dynamicContentContainer.hasChildNodes()) {
          dynamicContentContainer.innerHTML = "<div style='padding: 10px; text-align: center; color: orange;'>Couldn't load streams. Please try again later.</div>";
        }
        return;
      }

      if (!result.twitchAccessToken) {
        console.log("[DEBUG] Not logged in during stream update trigger, switching to login view.");
        checkLoginAndDisplayAppropriateUI();
        return;
      }

      console.log(`[DEBUG] Got ${result.liveStreams ? result.liveStreams.length : 0} live streams`);

      const streamsData = {
        liveStreams: result.liveStreams || [],
        favoriteGroups: result.favoriteGroups || [],
        showAvatar: result.showAvatar !== undefined ? result.showAvatar : true,
        channelAccess: result.channelAccess || {},
        hideAccessedCount: result.hideAccessedCount !== undefined ? result.hideAccessedCount : false,
        streamGrouping: result.streamGrouping || "none",
        showStreamTime: result.showStreamTime === "on",
        streamTitleDisplay: result.streamTitleDisplay || "hover",

        // 🔥 HERE’S THE IMPORTANT LINE:
        isInitialLoad: isFirstStreamLoad
      };

      // Update the stream list UI
      updateLiveStreams(streamsData);

      // 🔁 Mark first load as done
      if (isFirstStreamLoad) {
        isFirstStreamLoad = false;
      }
    }
  );
}



// ----- incrementChannelAccess function definition REMOVED from here -----

function handleLoginClick() {
  console.log("[DEBUG] Login button clicked");
  // The login button itself is now inside dynamicContentContainer
  const loginButton = document.getElementById("loginButton");
  const description = document.getElementById("description"); // Get the description element
  const notLoggedInIcon = document.querySelector("#dynamicContentContainer img[src*='notlogged.webp']"); // Get the not logged in icon

  // Update button text/state to show progress
  if (loginButton) {
    loginButton.textContent = "Logging in...";
    loginButton.disabled = true;

    // Hide the description if it exists
    if (description) {
      description.style.display = "none";
    }

    // Hide the not logged in icon if it exists
    if (notLoggedInIcon) {
      notLoggedInIcon.style.display = "none";
    }

    // Create a container for the loading GIF
    const loadingContainer = document.createElement("div");
    loadingContainer.id = "loginLoadingContainer";
    loadingContainer.style.textAlign = "center";
    loadingContainer.style.marginTop = "20px";
    loadingContainer.style.marginBottom = "20px";

    // Create and set up the loading image
    const loadingImg = document.createElement("img");
    loadingImg.src = "../../css/loading.webp";
    loadingImg.alt = "Loading...";
    loadingImg.style.width = "48px";
    loadingImg.style.height = "48px";

    // Add the image to the container
    loadingContainer.appendChild(loadingImg);

    // Add a message below the loading GIF
    const loadingMsg = document.createElement("div");
    loadingMsg.textContent = "Connecting to Twitch...";
    loadingMsg.style.marginTop = "10px";
    loadingMsg.style.fontSize = "12px";
    loadingMsg.style.color = "#999";
    loadingContainer.appendChild(loadingMsg);

    // Insert the loading container after the login button
    if (loginButton.parentNode) {
      loginButton.parentNode.insertBefore(loadingContainer, loginButton.nextSibling);
    } else if (dynamicContentContainer) {
      dynamicContentContainer.appendChild(loadingContainer);
    }
  }

  // Enable active checking for auth completion
  activeAuthCheck = true;

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
  // This now calls the function defined globally in channelAccess.js
  incrementChannelAccess(broadcasterLogin);

  // Then open the link (use setTimeout to ensure storage write likely completes before navigation)
  setTimeout(() => {
    // Ensure URL is valid before opening
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      window.open(url, "_blank");
    } else {
      console.error("Invalid URL provided for stream link:", url);
    }
  }, 50); // Small delay
}