// --- popup.js ---

// --- Helper Function ---
function showDynamicContent() {
  if (initialPlaceholder) initialPlaceholder.style.display = 'none';
  if (dynamicContentContainer) dynamicContentContainer.style.display = 'block'; // Or 'flex' etc. if needed
}

// Global flag to prevent multiple simultaneous updates if needed
let isUpdatingStreams = false; // Make sure this is defined at the top level

// Flag to detect if we need to actively poll for auth completion
let activeAuthCheck = false;
let noStreamsShowing = false;

// --- Modify the DOMContentLoaded event handler ---
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
  // If we show "No followed channels are currently live" we should check more frequently
  const streamCheckInterval = setInterval(function () {
    // Only run this check for a limited time after popup opens
    if (dynamicContentContainer) {
      console.log("[DEBUG] Checking content: ", dynamicContentContainer.innerText);

      // Check if "No followed channels" message is showing
      if (dynamicContentContainer.innerText.includes("No followed channels are currently live")) {
        console.log("[DEBUG] Empty stream list detected, enabling active checking");
        noStreamsShowing = true;

        // Check if we're actually logged in
        chrome.storage.local.get("twitchAccessToken", function (result) {
          if (result.twitchAccessToken) {
            console.log("[DEBUG] We have a token but no streams shown - forcing update");
            // We're logged in but showing no streams - this is our target case
            triggerUpdateLiveStreams();
          }
        });
      } else {
        // We have content or different message, can disable active checking
        noStreamsShowing = false;
      }
    }
  }, 2000); // Check every 2 seconds

  // Only run this special check for 30 seconds after popup opens
  setTimeout(() => {
    clearInterval(streamCheckInterval);
    console.log("[DEBUG] Disabling special content check");
  }, 30000);

  // Set interval for updates (will update the dynamic content area)
  setInterval(function () {
    // Only trigger updates if logged in (checkLogin will handle showing login if needed)
    chrome.storage.local.get("twitchAccessToken", function (result) {
      if (result.twitchAccessToken) {
        triggerUpdateLiveStreams();
      } else {
        // Re-check login periodically in case token expires or user logs out
        checkLoginAndDisplayAppropriateUI();
      }
    });
  }, 30000); // 30 seconds

  // Rate limit check
  setTimeout(initRateLimitCheck, 1000); // Assuming this doesn't need login

  // Listener for OAuth completion from background script
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "oauthComplete") {
      console.log("[DEBUG] OAuth complete message received in popup.");
      applyDarkMode(); // Re-apply theme if needed

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
    [ // Make sure you have all your necessary keys here
      "twitchAccessToken", "liveStreams", "favoriteGroups", "showAvatar",
      "channelAccess", "hideAccessedCount", "streamGrouping", "showStreamTime",
      "streamTitleDisplay",
    ],
    function (result) {
      // Reset flag regardless of outcome
      isUpdatingStreams = false;

      if (chrome.runtime.lastError) {
        console.error("[DEBUG] Error fetching data for stream update:", chrome.runtime.lastError);
        if (dynamicContentContainer) {
          // Log the error, maybe show a small indicator if content already exists
          console.error("[DEBUG] Couldn't refresh streams.", chrome.runtime.lastError.message);
          // Optionally, show an error message if the container is empty
          if (!dynamicContentContainer.hasChildNodes()) {
            dynamicContentContainer.innerHTML = "<div style='padding: 10px; text-align: center; color: orange;'>Couldn't load streams. Please try again later.</div>";
          }
        }
        return;
      }

      // Only proceed if logged in
      if (!result.twitchAccessToken) {
        console.log("[DEBUG] Not logged in during stream update trigger, switching to login view.");
        checkLoginAndDisplayAppropriateUI(); // Re-check and show login if needed
        return;
      }

      // Log stream count
      console.log(`[DEBUG] Got ${result.liveStreams ? result.liveStreams.length : 0} live streams`);

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
      // This function MUST target the 'dynamicContentContainer' now
      updateLiveStreams(streamsData); // Defined in ui.js

    } // end storage callback
  ); // end storage.local.get
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