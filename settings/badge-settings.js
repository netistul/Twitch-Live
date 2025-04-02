// settings/badge-settings.js

/**
 * Initializes the Badge Settings section.
 * Loads the current badge visibility setting and sets up the toggle switch listener.
 */
function initializeBadgeSettingsSection() {
    console.log("Initializing Badge Settings Section...");
    const enableBadgeCheckbox = document.getElementById("enableBadgeCheckbox");

    if (!enableBadgeCheckbox) {
        console.error("Enable Badge Checkbox not found.");
        return;
    }

    // 1. Load the initial setting
    chrome.storage.local.get("showBadge", function (data) {
        // Default to true (badge shown) if the setting doesn't exist yet
        const showBadge = data.showBadge !== undefined ? data.showBadge : true;
        enableBadgeCheckbox.checked = showBadge;

        // Save the default value if it wasn't set previously
        if (data.showBadge === undefined) {
            chrome.storage.local.set({ showBadge: true });
            // Send initial state to background if setting for the first time
            sendBadgeUpdateToBackground(true);
        }
    });

    // 2. Add listener for changes
    enableBadgeCheckbox.addEventListener("change", function () {
        const isChecked = this.checked;
        console.log("Badge setting changed:", isChecked);

        // 3. Save the setting using the existing function (which also sends 'oauthComplete')
        // Note: 'oauthComplete' might not be the *perfect* message, but it triggers
        // background updates. A more specific message could be used if needed,
        // but for simplicity, we'll reuse it for now.
        saveSettingsAndNotify({ showBadge: isChecked });

        // 4. Send a specific message to the background script IMMEDIATELY
        //    to update the badge state, regardless of the generic 'oauthComplete' message.
        sendBadgeUpdateToBackground(isChecked);
    });

    console.log("Badge Settings Section Initialized.");
}

/**
 * Sends a message to the background script to update the badge visibility.
 * @param {boolean} showBadge - Whether the badge should be shown or hidden.
 */
function sendBadgeUpdateToBackground(showBadge) {
    chrome.runtime.sendMessage({ action: "updateBadgeState", showBadge: showBadge }, (response) => {
        if (chrome.runtime.lastError) {
            // Handle potential errors like the background script not being ready
            // or if the receiving end doesn't exist (less likely for background)
            if (!chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
                console.warn("Error sending badge update message:", chrome.runtime.lastError.message);
            }
        } else {
            // Optional: Log background confirmation
            // console.log("Background responded to badge update:", response);
        }
    });
}

// Note: We assume initializeBadgeSettingsSection will be called by settings.js