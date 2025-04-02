// settings/badge-settings.js

/**
 * Initializes the Badge Settings section.
 * Loads the current badge visibility setting and sets up the toggle switch listener.
 * Also handles badge color selection.
 */
function initializeBadgeSettingsSection() {
    console.log("Initializing Badge Settings Section...");
    const enableBadgeCheckbox = document.getElementById("enableBadgeCheckbox");
    const colorBoxes = document.querySelectorAll(".color-box");
    const colorPicker = document.getElementById("badgeColorPicker");

    if (!enableBadgeCheckbox) {
        console.error("Enable Badge Checkbox not found.");
        return;
    }

    // 1. Load the initial settings
    chrome.storage.local.get(["showBadge", "badgeColor"], function (data) {
        // Default to true (badge shown) if the setting doesn't exist yet
        const showBadge = data.showBadge !== undefined ? data.showBadge : true;
        enableBadgeCheckbox.checked = showBadge;

        // Default color or user selected color
        const badgeColor = data.badgeColor || "#6366f1";

        // Update color picker with current color
        colorPicker.value = badgeColor;

        // Highlight the selected preset if it matches
        colorBoxes.forEach(box => {
            if (box.dataset.color === badgeColor) {
                box.classList.add("selected");
            }
        });

        // Save default values if they weren't set previously
        if (data.showBadge === undefined || data.badgeColor === undefined) {
            chrome.storage.local.set({
                showBadge: true,
                badgeColor: "#6366f1"
            });
            // Send initial state to background
            sendBadgeUpdateToBackground(true, "#6366f1");
        }
    });

    // 2. Add listener for visibility changes
    enableBadgeCheckbox.addEventListener("change", function () {
        const isChecked = this.checked;
        console.log("Badge setting changed:", isChecked);

        // Get current color
        chrome.storage.local.get("badgeColor", function (data) {
            const currentColor = data.badgeColor || "#6366f1";

            // Save settings
            saveSettingsAndNotify({
                showBadge: isChecked,
                badgeColor: currentColor
            });

            // Update badge
            sendBadgeUpdateToBackground(isChecked, currentColor);
        });
    });

    // 3. Add listeners for preset color boxes
    colorBoxes.forEach(box => {
        box.addEventListener("click", function () {
            const selectedColor = this.dataset.color;

            // Update visual selection
            colorBoxes.forEach(b => b.classList.remove("selected"));
            this.classList.add("selected");

            // Update color picker to match
            colorPicker.value = selectedColor;

            // Save the color
            saveAndUpdateBadgeColor(selectedColor);
        });
    });

    // 4. Add listener for custom color picker
    colorPicker.addEventListener("input", function () {
        const selectedColor = this.value;

        // Remove selection from preset boxes
        colorBoxes.forEach(box => box.classList.remove("selected"));

        // Save the color
        saveAndUpdateBadgeColor(selectedColor);
    });

    console.log("Badge Settings Section Initialized.");
}

/**
 * Saves and updates the badge color
 * @param {string} color - The color in hex format (e.g. "#6366f1")
 */
function saveAndUpdateBadgeColor(color) {
    // Get current badge visibility
    chrome.storage.local.get("showBadge", function (data) {
        const showBadge = data.showBadge !== undefined ? data.showBadge : true;

        // Save settings
        saveSettingsAndNotify({
            showBadge: showBadge,
            badgeColor: color
        });

        // Update badge
        sendBadgeUpdateToBackground(showBadge, color);
    });
}

/**
 * Sends a message to the background script to update the badge visibility and color.
 * @param {boolean} showBadge - Whether the badge should be shown or hidden.
 * @param {string} badgeColor - The color of the badge in hex format.
 */
function sendBadgeUpdateToBackground(showBadge, badgeColor) {
    chrome.runtime.sendMessage({
        action: "updateBadgeState",
        showBadge: showBadge,
        badgeColor: badgeColor
    }, (response) => {
        if (chrome.runtime.lastError) {
            // Handle potential errors
            if (!chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
                console.warn("Error sending badge update message:", chrome.runtime.lastError.message);
            }
        } else {
            // Optional: Log background confirmation
            console.log("Background responded to badge update:", response);
        }
    });
}

// Note: initializeBadgeSettingsSection will be called by settings.js