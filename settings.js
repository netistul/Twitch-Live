// settings.js

// --- UI Helpers: Notifications & Popups ---

let currentNotification = null;
let notificationTimer = null;

/**
* Shows a temporary notification popup at the bottom of the screen.
* @param {string} actionText - e.g., 'added to', 'removed from'.
* @param {string} action - 'added' or 'removed' (used for styling).
* @param {string} channelName - The name of the channel involved.
* @param {string} groupName - The name of the group involved.
*/
function showTemporaryNotification(actionText, action = 'added', channelName = '', groupName = '') {
  clearAllNotifications(); // Clear previous notification

  const popup = document.createElement('div');
  popup.className = 'temporary-info-popup';

  const icon = document.createElement('div');
  icon.className = `temporary-info-icon ${action}`; // Class controls the icon via CSS

  const content = document.createElement('div');
  content.className = 'notification-popup-content';

  if (channelName && groupName) {
    const channelDisplay = document.createElement('div');
    channelDisplay.className = 'notification-popup-channel-display';

    const twitchIcon = document.createElement('img');
    twitchIcon.className = 'notification-popup-twitch-icon';
    twitchIcon.src = 'css/twitch.png';

    const nameElement = document.createElement('span');
    nameElement.className = `notification-popup-channel notification-popup-channel--${action}`;
    nameElement.textContent = channelName;

    channelDisplay.append(twitchIcon, nameElement);
    content.append(channelDisplay);

    const fullText = document.createElement('span');
    // Ensure lowercase and consistent spacing
    fullText.textContent = ` ${actionText.trim()} list ${groupName.trim()}`.toLowerCase();
    content.append(fullText);
  } else {
    // Fallback for simpler messages if needed
    const fallbackText = document.createElement('span');
    fallbackText.textContent = actionText.trim().toLowerCase();
    content.append(fallbackText);
  }

  popup.append(icon, content);
  document.body.appendChild(popup);
  currentNotification = popup;

  // Trigger animation (assuming CSS handles the 'show' class)
  requestAnimationFrame(() => {
    popup.classList.add('show');
  });

  // Auto-hide
  notificationTimer = setTimeout(() => {
    hideTemporaryNotification();
  }, 3200);
}

/** Hides the currently displayed temporary notification */
function hideTemporaryNotification() {
  if (currentNotification) {
    currentNotification.classList.remove('show');
    // Use transitionend event for cleaner removal after animation
    currentNotification.addEventListener('transitionend', () => {
      if (currentNotification && currentNotification.parentNode) {
        currentNotification.remove();
      }
      currentNotification = null; // Clear reference
    }, { once: true }); // Ensure listener runs only once

    clearTimeout(notificationTimer); // Clear timer if hidden manually
    notificationTimer = null;
  }
}

/** Clears any active temporary notification immediately */
function clearAllNotifications() {
  if (notificationTimer) {
    clearTimeout(notificationTimer);
    notificationTimer = null;
  }
  if (currentNotification) {
    if (currentNotification.parentNode) {
      currentNotification.remove();
    }
    currentNotification = null;
  }
}

/**
* Shows a simple informational message popup (legacy?).
* Consider using showTemporaryNotification for consistency.
* @param {string} message - The text message to display.
*/
function showTemporaryInfo(message) {
  // TODO: Evaluate if this is still needed or can be replaced by showTemporaryNotification
  console.warn("showTemporaryInfo is likely deprecated. Consider using showTemporaryNotification.");

  const infoDiv = document.createElement("div");
  infoDiv.textContent = message;
  infoDiv.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background-color: #4CAF50; color: white; padding: 10px; border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 1000; text-align: center;
      transition: opacity 0.5s ease-out; opacity: 1;
  `;
  document.body.appendChild(infoDiv);

  setTimeout(() => {
    infoDiv.style.opacity = '0';
    infoDiv.addEventListener('transitionend', () => infoDiv.remove(), { once: true });
  }, 3000);
}

// --- Core Functionality: Settings & Options ---


// --- Helper Functions ---

/**
* Fetches the list of followed channels from storage.  (Used by Favorites and Notifications)
* @returns {Promise<Array>} A promise that resolves with the followed list or rejects.
*/
function getFollowedList() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("followedList", function (data) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (data.followedList && Array.isArray(data.followedList)) {
        resolve(data.followedList);
      } else {
        // Resolve with empty array if not found or not an array, simplifying calling code
        resolve([]);
      }
    });
  });
}


// --- Initialization and Event Listeners Setup ---

/**
* Main function to initialize the settings page.
* Called after the DOM is fully loaded.
*/
function initializeSettingsPage() {
  console.log("Initializing Settings Page...");

  // Initialize sections via their specific initializers
  initializeUserSection(); // Handles user section
  initializeFavoriteGroupsSection(); // Handles groups list AND add group modal setup
  initializeNotificationsSection(); // Handles notification toggles and channel list
  initializeDisplaySection();       // Handles display toggles, dropdowns, and preview

  // Setup remaining interactive elements and listeners managed by settings.js
  setupMenuNavigation();            // Handles side menu clicks and section visibility

  // Setup listener for messages from background
  setupBackgroundMessageListener();

  console.log("Main Settings Page Initialized.");
}

/** Sets up the side menu navigation */
function setupMenuNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.querySelectorAll('.settings-section');

  if (!menuItems.length || !sections.length) {
    console.error("Menu items or settings sections not found.");
    return;
  }

  // --- CHANGE HERE: Set the initial active section to 'display' ---
  const initialSectionName = 'display'; // Set the desired default section name
  const initialSectionId = initialSectionName + '-section';
  const initialMenuItem = document.querySelector(`.menu-item[data-section="${initialSectionName}"]`);
  // --- End of Change ---

  // Deactivate all sections and menu items first
  sections.forEach(s => s.classList.remove('active'));
  menuItems.forEach(i => i.classList.remove('active'));

  // Activate the initial section and menu item
  const initialSectionElement = document.getElementById(initialSectionId);
  if (initialSectionElement) {
    initialSectionElement.classList.add('active');
    console.log(`Initial section set to: ${initialSectionId}`);
  } else {
    console.warn(`Initial section element not found: ${initialSectionId}. Defaulting might fail.`);
    // Optionally activate the very first section as a fallback
    // sections[0]?.classList.add('active');
  }

  if (initialMenuItem) {
    initialMenuItem.classList.add('active');
    console.log(`Initial menu item set for: ${initialSectionName}`);
  } else {
    console.warn(`Initial menu item not found for data-section: ${initialSectionName}.`);
    // Optionally activate the very first menu item as a fallback
    // menuItems[0]?.classList.add('active');
  }


  // Add click listeners for navigation
  menuItems.forEach(item => {
    item.addEventListener('click', function (e) {
      e.preventDefault(); // Prevent default anchor behavior if using <a> tags
      const sectionName = this.getAttribute('data-section');
      if (!sectionName) return;

      const sectionId = sectionName + '-section';
      const targetSection = document.getElementById(sectionId);

      if (targetSection && !this.classList.contains('active')) { // Only switch if not already active
        // Deactivate all
        menuItems.forEach(i => i.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));

        // Activate clicked item and corresponding section
        this.classList.add('active');
        targetSection.classList.add('active');
        console.log(`Navigated to section: ${sectionId}`);
      }
    });
  });

  // Tooltip positioning logic (can stay here or move to a dedicated UI setup function)
  setupTooltips();
}

/** Sets up tooltip dynamic positioning */
function setupTooltips() {
  const labelsWithTooltips = document.querySelectorAll('.styled-label');
  labelsWithTooltips.forEach(label => {
    const tooltip = label.querySelector('.tooltip-text');
    if (tooltip) {
      label.addEventListener('mouseenter', function () {
        tooltip.classList.remove('position-bottom'); // Reset
        const labelRect = label.getBoundingClientRect();
        const tooltipHeight = tooltip.offsetHeight;
        // Simple check: if not enough space above (e.g., less than tooltip height + small buffer)
        if (labelRect.top < tooltipHeight + 10) {
          tooltip.classList.add('position-bottom');
        }
      });
    }
  });
}


/**
* Applies the selected theme to the document body.
* @param {string} themePreference - 'light', 'dark', or 'verydark'.
*/
function setTheme(themePreference) {
  document.body.classList.remove("dark-mode", "light-mode", "very-dark-mode");
  switch (themePreference) {
    case "dark":
      document.body.classList.add("dark-mode");
      break;
    case "verydark":
      document.body.classList.add("dark-mode", "very-dark-mode"); // Add both for potential CSS fallback/override
      break;
    case "light":
    default:
      document.body.classList.add("light-mode");
      break;
  }
  console.log("Theme applied:", themePreference);
}



/**
 * Saves specified settings to chrome.storage.local and sends the 'oauthComplete' message  (Used by Display, Notifications, potentially others)
 * without expecting a response.
 * @param {object} settingsObject - An object containing key-value pairs to save.
 */
function saveSettingsAndNotify(settingsObject) {
  chrome.storage.local.set(settingsObject, function () {
    if (chrome.runtime.lastError) {
      console.error("Error saving settings:", chrome.runtime.lastError, settingsObject);
      alert("Failed to save settings. Please try again.");
      return; // Exit if saving failed
    }

    console.log("Settings saved:", settingsObject);

    // --- Send the message WITHOUT the callback function ---
    chrome.runtime.sendMessage({ action: "oauthComplete" });

    // --- Check for immediate connection errors (optional but good practice) ---
    // This error check needs to happen *immediately* after sending if no callback is provided.
    // It primarily catches if there are NO listeners at all (e.g., background script error).
    // It won't catch the "port closed" error because we are no longer waiting for a response.
    if (chrome.runtime.lastError) {
      // Ignore "Receiving end does not exist" which just means the popup wasn't open.
      if (!chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
        console.warn("Error sending oauthComplete message:", chrome.runtime.lastError.message);
      }
    } else {
      // console.log("Sent oauthComplete message (fire-and-forget).");
    }
    // --- End of message sending ---
  });
}

// --- Background Message Listener ---

/** Sets up the listener for messages from the background script or other contexts */
function setupBackgroundMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in settings:", message);
    let handled = false;

    switch (message.action) {
      case "oauthComplete":
        console.log("OAuth process completed or permissions updated.");

        // --- Step 1: Update User Display Immediately ---
        if (typeof initializeUserSection === 'function') {
          console.log("oauthComplete: Updating User Section...");
          initializeUserSection();
        } else {
          console.error("initializeUserSection function not found!");
        }

        // --- Step 2: Refresh other sections that depend on login/followed status ---
        if (typeof displayGroups === 'function') {
          console.log("oauthComplete: Refreshing Favorite Groups...");
          displayGroups();
        } else {
          console.error("displayGroups function not found!");
        }

        if (typeof checkAndLoadNotificationChannels === 'function') {
          console.log("oauthComplete: Refreshing Notification Channels...");
          checkAndLoadNotificationChannels();
        } else {
          console.error("checkAndLoadNotificationChannels function not found!");
        }

        // --- Step 3: Update Preview reliably by checking for data ---
        if (typeof waitForLiveStreamsAndUpdatePreview === 'function') {
          console.log("oauthComplete: Starting intelligent preview update...");
          waitForLiveStreamsAndUpdatePreview();
        } else {
          console.error("waitForLiveStreamsAndUpdatePreview function not found!");
          // Fallback to direct update
          if (typeof updatePreview === 'function') updatePreview();
        }

        sendResponse({ status: "Settings UI refreshing after oauthComplete (with data-aware preview update)" });
        handled = true;
        break;

      // --- Other cases remain the same or adjust similarly ---
      case "settingsChanged":
        console.log("Settings changed message received.");
        if (typeof displayGroups === 'function') displayGroups();
        if (typeof updatePreview === 'function') updatePreview();
        sendResponse({ status: "Settings UI potentially updated based on external change" });
        handled = true;
        break;

      case "followedListUpdated":
        console.log("Followed list updated message received.");
        if (typeof checkAndLoadNotificationChannels === 'function') checkAndLoadNotificationChannels();
        if (typeof displayGroups === 'function') displayGroups();
        sendResponse({ status: "Notification channels/Groups potentially reloaded" });
        handled = true;
        break;


      default:
        if (!handled) {
          sendResponse({ status: "Message not handled by settings UI" });
        }
        break;
    }
    return true;
  });
}

// --- Global Initialization Trigger ---

// Wait for the DOM to be fully loaded before initializing the page
document.addEventListener('DOMContentLoaded', initializeSettingsPage);