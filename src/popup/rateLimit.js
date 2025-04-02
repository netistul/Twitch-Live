// rateLimit.js

// Initializes the rate limit check and notification system
function initRateLimitCheck() {
    const delay = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    // Check if we have a stored rate limit flag
    chrome.storage.local.get(['rateLimitHit', 'rateLimitTimestamp', 'rateLimitDetails', 'rateLimitDismissedTimestamp'], function (data) {
        const now = Date.now();
        const dismissTime = data.rateLimitDismissedTimestamp || 0;

        // If the user dismissed it recently (within 7 days), don't show it
        if (now - dismissTime < delay) {
            console.log("Skipping rate limit notification due to recent dismissal.");
            return;
        }

        // If we hit a rate limit in the last 5 minutes, show notification
        // Also check if rateLimitHit is explicitly true
        if (data.rateLimitHit === true && data.rateLimitTimestamp &&
            (now - data.rateLimitTimestamp < 5 * 60 * 1000)) {
            showRateLimitNotification(data.rateLimitDetails);
        } else if (data.rateLimitHit === true && !data.rateLimitTimestamp) {
            // Handle case where rateLimitHit is true but timestamp is missing (maybe an older state)
            // Decide if you want to show notification or reset state
            console.warn("Rate limit hit flag is true, but timestamp is missing. Resetting flag.");
            chrome.storage.local.set({ rateLimitHit: false });
        }
    });

    // Listen for real-time rate limit messages from background.js
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        if (message.action === "rateLimitHit") {
            console.log("Received rateLimitHit message from background.");
            chrome.storage.local.get(['rateLimitDismissedTimestamp'], function (data) {
                const now = Date.now();
                const dismissTime = data.rateLimitDismissedTimestamp || 0;

                // Prevent showing if dismissed recently (within 7 days)
                if (now - dismissTime < delay) {
                    console.log("Skipping real-time rate limit notification due to recent dismissal.");
                    sendResponse({ received: true, skipped: 'dismissed' }); // Acknowledge but indicate skip
                    return true; // Indicate async response
                }

                showRateLimitNotification(message.details);
                sendResponse({ received: true, shown: true }); // Acknowledge and indicate shown
            });
            return true; // Keep the message channel open for the async response
        }
    });

    // Listen for changes to the rate limit in storage (optional, but good for robustness)
    chrome.storage.onChanged.addListener(function (changes, namespace) {
        if (namespace === 'local' && changes.rateLimitHit &&
            changes.rateLimitHit.newValue === true) {
            console.log("Detected rateLimitHit change in storage.");
            chrome.storage.local.get(['rateLimitDetails', 'rateLimitDismissedTimestamp', 'rateLimitTimestamp'], function (data) {
                const now = Date.now();
                const dismissTime = data.rateLimitDismissedTimestamp || 0;
                const hitTime = data.rateLimitTimestamp || 0; // Use the stored timestamp

                // Skip notification if dismissed recently (within 7 days)
                if (now - dismissTime < delay) {
                    console.log("Skipping storage change notification due to recent dismissal.");
                    return;
                }

                // Also ensure the hit time is recent if checking via storage change
                if (now - hitTime < 5 * 60 * 1000) {
                    showRateLimitNotification(data.rateLimitDetails);
                } else {
                    console.log("Skipping storage change notification as hit timestamp is too old.");
                }
            });
        }
    });
}

// Displays the rate limit notification in the popup
function showRateLimitNotification(details) {
    // Check if a notification is already showing
    if (document.querySelector('.rate-limit-notification')) {
        console.log("Rate limit notification already visible.");
        return; // Don't show another notification if one is already visible
    }
    console.log("Attempting to show rate limit notification.");

    // Ensure the header element exists
    const header = document.getElementById('header');
    if (!header) {
        console.error("Header element not found, cannot display rate limit notification.");
        return;
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'rate-limit-notification';

    // Create title
    const title = document.createElement('div');
    title.className = 'notification-title';
    title.textContent = 'API Rate Limit Reached';

    // Create message
    const message = document.createElement('div');
    message.className = 'notification-message';
    // Updated message for clarity
    message.textContent = `Twitch API limits were reached. This can happen if multiple Twitch extensions (like this one, Gumbo, etc.) run simultaneously. Try disabling other Twitch extensions if streams aren't updating correctly.`;

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.textContent = '×'; // Use multiplication sign '×' for better visuals
    closeButton.title = 'Dismiss (hide for 7 days)'; // Add tooltip
    closeButton.addEventListener('click', function () {
        notification.remove();
        // Store the dismissal timestamp to prevent re-showing for 7 days
        chrome.storage.local.set({
            rateLimitHit: false, // Also reset the hit flag when dismissed
            rateLimitDismissedTimestamp: Date.now()
        }, () => {
            console.log("Rate limit notification dismissed for 7 days.");
        });
    });

    // Assemble notification
    notification.appendChild(title);
    notification.appendChild(message);
    notification.appendChild(closeButton);

    // Insert notification just below the header
    header.parentNode.insertBefore(notification, header.nextSibling);
    console.log("Rate limit notification displayed.");

    // Auto-dismiss after 1 minute (optional, consider user experience)
    /*
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.remove();
        console.log("Rate limit notification auto-dismissed.");
      }
    }, 60000); // 60 seconds
    */
}