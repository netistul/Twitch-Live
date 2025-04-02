// channelAccess.js
// Logic for managing channel access counts stored in chrome.storage.local

/**
 * Increments the access count for a specific broadcaster in storage.
 * Gets the current counts, increments the specific broadcaster's count (or initializes it to 1),
 * and saves the updated object back to storage.
 *
 * @param {string} broadcasterLogin - The login name of the broadcaster whose count needs incrementing.
 */
function incrementChannelAccess(broadcasterLogin) {
    if (!broadcasterLogin) {
        console.error("incrementChannelAccess called without a broadcasterLogin.");
        return;
    }

    console.log(`Attempting to increment access count for ${broadcasterLogin}`);

    chrome.storage.local.get(["channelAccess"], function (result) {
        if (chrome.runtime.lastError) {
            console.error("Error getting channel access:", chrome.runtime.lastError);
            return; // Exit if we can't read storage
        }

        // Initialize channelAccess as an empty object if it doesn't exist or is not an object
        let channelAccess = result.channelAccess && typeof result.channelAccess === 'object' ? result.channelAccess : {};

        // Increment the count for the specific broadcaster.
        // Uses || 0 to handle cases where the key doesn't exist yet.
        channelAccess[broadcasterLogin] = (channelAccess[broadcasterLogin] || 0) + 1;

        // Save the updated object back to storage
        chrome.storage.local.set({ channelAccess: channelAccess }, () => {
            if (chrome.runtime.lastError) {
                console.error(`Error setting updated channel access for ${broadcasterLogin}:`, chrome.runtime.lastError);
            } else {
                console.log(`Access count for ${broadcasterLogin} successfully updated to ${channelAccess[broadcasterLogin]}`);
                // Optional: If you need the UI to react *immediately* to the count change
                // (e.g., for sorting), you might need a way to notify popup.js.
                // Sending a message is safer than directly calling triggerUpdateLiveStreams here.
                // Example: chrome.runtime.sendMessage({ action: "channelAccessUpdated" });
                // popup.js would then need a listener for this message.
                // For now, we assume the next periodic refresh is sufficient.
            }
        });
    });
}

// You could add other functions related to channel access here in the future,
// like getChannelAccessCount(broadcasterLogin), resetCounts(), etc.