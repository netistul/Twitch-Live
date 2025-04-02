// settings/notifications-settings.js
//
// --- Notification Filtering Setup ---

let notificationCheckInterval = null; // Timer for checking followed list
const CHECK_INTERVAL_MS = 3000; // Check every 3 seconds if list is initially empty

/** Sets up notification enable/filter controls and channel list */
function setupNotificationSettings() {
    const notificationCheckbox = document.getElementById("enableNotificationsCheckbox");
    const filterCheckbox = document.getElementById("enableFilterCheckbox");
    const filterOptionContainer = document.getElementById("filterNotificationOption"); // The div containing the filter checkbox/label
    const channelListDiv = document.getElementById("channelList"); // Renamed for clarity
    const labelText = document.querySelector("label[for='enableNotificationsCheckbox'] .label-text");
    const tooltipText = document.querySelector("label[for='enableNotificationsCheckbox'] .tooltip-text");


    if (!notificationCheckbox || !filterCheckbox || !filterOptionContainer || !channelListDiv || !labelText || !tooltipText) {
        console.error("Notification settings elements missing!");
        return;
    }

    // Function to update the main notification toggle's text/tooltip
    const updateNotificationToggleText = (isEnabled) => {
        if (isEnabled) {
            labelText.textContent = "Live Notifications Enabled";
            tooltipText.textContent = "You will receive notifications when selected Twitch channels go live. Click to disable.";
        } else {
            labelText.textContent = "Enable Live Notifications";
            tooltipText.textContent = "Activate to receive notifications when selected Twitch channels go live.";
        }
    };

    // Function to update the enabled/disabled state of filter controls
    const updateFilterControlState = (notificationsEnabled) => {
        filterOptionContainer.classList.toggle("disabled", !notificationsEnabled);
        filterCheckbox.disabled = !notificationsEnabled;
        // Update channel list appearance based on whether filtering is possible
        updateChannelListAppearance(notificationsEnabled && filterCheckbox.checked);
    };

    // Load initial states from storage
    chrome.storage.local.get(["enableNotifications", "enableFilter", "selectedChannels"], function (data) {
        const isNotificationsEnabled = data.enableNotifications || false;
        const isFilterEnabled = data.enableFilter || false;
        const safeSelectedChannels = Array.isArray(data.selectedChannels) ? data.selectedChannels : [];

        notificationCheckbox.checked = isNotificationsEnabled;
        filterCheckbox.checked = isFilterEnabled;

        updateNotificationToggleText(isNotificationsEnabled);
        updateFilterControlState(isNotificationsEnabled);

        // Load the channel list initially
        loadNotificationChannelList(channelListDiv, safeSelectedChannels, isNotificationsEnabled && isFilterEnabled);
        checkAndLoadNotificationChannels(); // Start check if needed
    });

    // --- Event Listeners ---

    // Notification Enable/Disable Toggle
    notificationCheckbox.addEventListener("change", function () {
        const isChecked = this.checked;
        saveSettingsAndNotify({ enableNotifications: isChecked });

        updateNotificationToggleText(isChecked);
        updateFilterControlState(isChecked);

        // If disabling notifications, ensure filter is also visually unchecked and saved as false
        if (!isChecked && filterCheckbox.checked) {
            filterCheckbox.checked = false;
            saveSettingsAndNotify({ enableFilter: false }); // Also save filter state
            updateChannelListAppearance(false); // Update list appearance
        }
    });

    // Filter Enable/Disable Toggle Prevent Click when Disabled
    filterOptionContainer.addEventListener("click", function (e) {
        if (filterCheckbox.disabled) {
            e.preventDefault();
            e.stopPropagation(); // Stop propagation to prevent label activating checkbox
            // Shake effect to indicate it's disabled
            this.classList.remove('shake-it'); // Remove first to reset animation
            void this.offsetWidth; // Trigger reflow
            this.classList.add('shake-it');
            // Show tooltip briefly (optional)
            this.classList.add('force-tooltip');
            setTimeout(() => {
                this.classList.remove('force-tooltip');
                this.classList.remove('shake-it');
            }, 800); // Duration matches animation + buffer
        }
        // Note: Do NOT handle the actual checkbox change here, the 'change' listener below does that.
    });


    // Filter Enable/Disable Toggle Change Logic
    filterCheckbox.addEventListener("change", function () {
        // This should only fire if the checkbox wasn't disabled
        const isChecked = this.checked;
        saveSettingsAndNotify({ enableFilter: isChecked });
        updateChannelListAppearance(isChecked); // Update list based on filter state

        // If disabling filter, clear selected channels
        if (!isChecked) {
            clearSelectedNotificationChannels(channelListDiv);
        }
    });

}

/** Checks if the channel list is empty and starts polling if necessary */
function checkAndLoadNotificationChannels() {
    const channelListDiv = document.getElementById("channelList");
    if (!channelListDiv) return;

    stopNotificationCheckInterval(); // Clear existing interval first

    // Always try to load immediately when called (e.g., after login)
    loadNotificationChannelList(channelListDiv);

    // Only start polling if the list is still empty after initial load
    if (channelListDiv.children.length === 0 ||
        (channelListDiv.children.length === 1 &&
            channelListDiv.querySelector('.channel-list-empty-message'))) {
        console.log("Notification channel list empty, starting check...");
        notificationCheckInterval = setInterval(() => {
            console.log("Checking for followed list for notifications...");
            loadNotificationChannelList(channelListDiv);
        }, CHECK_INTERVAL_MS);
    } else {
        console.log("Notification channel list populated.");
        // Ensure appearance is correct based on current settings
        chrome.storage.local.get(['enableNotifications', 'enableFilter'], data => {
            updateChannelListAppearance(data.enableNotifications && data.enableFilter);
        });
    }
}

/** Stops the interval checking for the followed list */
function stopNotificationCheckInterval() {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
        notificationCheckInterval = null;
        console.log("Stopped notification channel list check interval.");
    }
}

/**
* Loads the list of followed channels into the notification filter section.
* @param {HTMLElement} channelListDiv - The container element for the list.
* @param {Array} [initialSelectedChannels] - Pre-selected channels (optional, used on initial load).
* @param {boolean} [isListCurrentlyEnabled] - Whether the list should be interactive (optional).
*/
async function loadNotificationChannelList(channelListDiv, initialSelectedChannels = null, isListCurrentlyEnabled = null) {
    if (!channelListDiv) return;

    try {
        const followedList = await getFollowedList();

        // If list is empty or unchanged, don't redraw unless forced
        // Basic check: compare length. More robust: compare content hash or stringify.
        // if (channelListDiv.children.length === followedList.length && channelListDiv.children.length > 0) {
        //      console.log("Followed list seems unchanged, skipping redraw.");
        //      stopNotificationCheckInterval(); // Stop checking if list is now populated
        //      return;
        // }

        if (followedList.length === 0) {
            channelListDiv.innerHTML = '<p class="channel-list-empty-message">No followed channels found. Follow channels on Twitch to filter notifications.</p>';
            // Keep checking if interval is running
            return;
        }

        // --- List has data, stop checking and render ---
        stopNotificationCheckInterval();
        channelListDiv.innerHTML = ""; // Clear previous content (including empty message)

        // Determine selected channels - use initial if provided, otherwise fetch fresh
        const selectedChannels = initialSelectedChannels !== null ?
            new Set(initialSelectedChannels) :
            await new Promise(resolve => chrome.storage.local.get("selectedChannels", data => resolve(new Set(Array.isArray(data.selectedChannels) ? data.selectedChannels : []))));

        // Determine if list should be enabled - use initial if provided, otherwise fetch fresh
        const listEnabled = isListCurrentlyEnabled !== null ?
            isListCurrentlyEnabled :
            await new Promise(resolve => chrome.storage.local.get(["enableNotifications", "enableFilter"], data => resolve(data.enableNotifications && data.enableFilter)));


        // Sort followed list alphabetically
        followedList.sort((a, b) => a.broadcaster_name.localeCompare(b.broadcaster_name));

        followedList.forEach(channel => {
            if (channel && channel.broadcaster_name) {
                const channelDiv = createNotificationChannelItem(channel, selectedChannels.has(channel.broadcaster_name), listEnabled);
                channelListDiv.appendChild(channelDiv);
            }
        });

        // Ensure overall list appearance matches enabled state
        updateChannelListAppearance(listEnabled);

    } catch (error) {
        console.error("Error loading followed list for notifications:", error);
        channelListDiv.innerHTML = '<p class="channel-list-error-message">Could not load followed channels. Please try again later.</p>';
        // Consider stopping interval on error too? Depends on retry strategy.
        // stopNotificationCheckInterval();
    }
}


/**
* Creates a single channel item for the notification filter list.
* @param {object} channel - Channel data object.
* @param {boolean} isSelected - Whether the channel is currently selected for notifications.
* @param {boolean} isEnabled - Whether the checkbox should be enabled.
* @returns {HTMLElement} The channel item div.
*/
function createNotificationChannelItem(channel, isSelected, isEnabled) {
    const channelDiv = document.createElement("div");
    channelDiv.className = `channel-checkbox-container ${isEnabled ? '' : 'disabled'}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `channel-${channel.broadcaster_id || channel.broadcaster_name}`; // Use ID if available, fallback to name
    checkbox.className = "channel-checkbox";
    checkbox.value = channel.broadcaster_name; // Store name in value for easy retrieval
    checkbox.checked = isSelected;
    checkbox.disabled = !isEnabled;

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = channel.broadcaster_name;

    checkbox.addEventListener("change", handleNotificationChannelSelectionChange);

    channelDiv.appendChild(checkbox);
    channelDiv.appendChild(label);
    return channelDiv;
}

/** Handles changes to channel selection in the notification list */
function handleNotificationChannelSelectionChange() {
    const channelListDiv = document.getElementById("channelList");
    if (!channelListDiv) return;

    const checkboxes = channelListDiv.querySelectorAll(".channel-checkbox:checked");
    const selectedChannelNames = Array.from(checkboxes).map(cb => cb.value);

    // Save the updated list of selected channels
    saveSettingsAndNotify({ selectedChannels: selectedChannelNames });
}

/** Clears all selected channels in the UI and storage */
function clearSelectedNotificationChannels(channelListDiv) {
    if (!channelListDiv) channelListDiv = document.getElementById("channelList");
    if (!channelListDiv) return;

    const checkboxes = channelListDiv.querySelectorAll(".channel-checkbox");
    checkboxes.forEach(checkbox => checkbox.checked = false);
    saveSettingsAndNotify({ selectedChannels: [] });
    console.log("Cleared all selected notification channels.");
}


/**
* Updates the visual appearance (opacity, cursor) of the channel list based on enabled state.
* @param {boolean} enabled - Whether the list should appear enabled.
*/
function updateChannelListAppearance(enabled) {
    const channelListDiv = document.getElementById("channelList");
    if (!channelListDiv) return;

    channelListDiv.style.opacity = enabled ? "1" : "0.5";
    const items = channelListDiv.querySelectorAll(".channel-checkbox-container");

    items.forEach(item => {
        const checkbox = item.querySelector(".channel-checkbox");
        item.classList.toggle("disabled", !enabled); // Use class for styling
        if (checkbox) {
            checkbox.disabled = !enabled;
            // CSS should handle cursor based on :disabled pseudo-class
            // checkbox.style.cursor = enabled ? "pointer" : "not-allowed";
        }
    });
}

/**
 * Initializes the Notifications section of the settings page.
 * Sets up the initial display and event listeners for notification controls.
 */
function initializeNotificationsSection() {
    console.log("Initializing Notifications Section...");
    setupNotificationSettings(); // Call the main setup function for this section
    console.log("Notifications Section Initialized.");
}