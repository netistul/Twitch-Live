// --- popup.js ---

// Global flag to prevent multiple simultaneous updates if needed
let isUpdatingStreams = false;

// --- Element References ---
// Get references early, but ensure DOM is ready
let initialPlaceholder = null;
let dynamicContentContainer = null;

// --- Helper Function ---
function showDynamicContent() {
  if (initialPlaceholder) initialPlaceholder.style.display = 'none';
  if (dynamicContentContainer) dynamicContentContainer.style.display = 'block'; // Or 'flex' etc. if needed
}

// --- Event Listeners & Initialization ---
document.addEventListener("DOMContentLoaded", function () {
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
      console.log("OAuth complete message received in popup.");
      applyDarkMode(); // Re-apply theme if needed
      // No need to hide placeholder spinner here, checkLogin will handle it

      // Check login which will trigger stream fetch
      checkLoginAndDisplayAppropriateUI();

      // Optional: Force refresh a few times shortly after login
      let refreshCount = 0;
      const refreshInterval = setInterval(() => {
        if (refreshCount < 3) {
          triggerUpdateLiveStreams(); // Updates dynamic content
          refreshCount++;
        } else {
          clearInterval(refreshInterval);
        }
      }, 500);

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
    console.log("Stream update already in progress.");
    return; // Prevent concurrent updates
  }

  isUpdatingStreams = true;
  console.log("Triggering live stream update...");

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
        console.error("Error fetching data for stream update:", chrome.runtime.lastError);
        if (dynamicContentContainer) {
          // Log the error, maybe show a small indicator if content already exists
          console.error("Couldn't refresh streams.", chrome.runtime.lastError.message);
          // Optionally, show an error message if the container is empty
          if (!dynamicContentContainer.hasChildNodes()) {
            dynamicContentContainer.innerHTML = "<div style='padding: 10px; text-align: center; color: orange;'>Couldn't load streams. Please try again later.</div>";
          }
        }
        return;
      }

      // Only proceed if logged in
      if (!result.twitchAccessToken) {
        console.log("Not logged in during stream update trigger, switching to login view.");
        checkLoginAndDisplayAppropriateUI(); // Re-check and show login if needed
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
      // This function MUST target the 'dynamicContentContainer' now
      updateLiveStreams(streamsData); // Defined in ui.js

    } // end storage callback
  ); // end storage.local.get
}


// ----- incrementChannelAccess function definition REMOVED from here -----


// --- UI Event Handlers (Called by listeners set up in ui.js) ---

function handleLoginClick() {
  console.log("Login button clicked.");
  // The login button itself is now inside dynamicContentContainer
  const loginButton = document.getElementById("loginButton");

  // Update button text/state to show progress
  if (loginButton) {
    loginButton.textContent = "Logging in...";
    loginButton.disabled = true;
    // Alternative: Use your existing showSpinner/hideSpinner IF showSpinner
    // can target a specific container *without* clearing its other content,
    // or if you place a dedicated spinner element next to the button.
    // For simplicity, changing button text is often sufficient.
    // e.g., showSpinner(loginButton.parentElement); // Might replace button if it clears innerHTML
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