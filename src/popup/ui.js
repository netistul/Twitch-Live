// --- ui.js ---

// Helper function to get elements (avoids repetition)
function getElement(id) {
    return document.getElementById(id);
}

// Centralized Spinner Management (Optional but good practice)
let spinnerElement = null;
function getSpinner() {
    if (!spinnerElement) {
        spinnerElement = document.createElement("img");
        spinnerElement.id = "spinner";
        spinnerElement.src = "../../css/loading.webp";
        spinnerElement.style.display = "none"; // Start hidden
        // Append it somewhere persistent if needed, or just keep the reference
        // document.body.appendChild(spinnerElement); // Example if needed globally
    }
    return spinnerElement;
}

function showSpinner(container) {
    const spinner = getSpinner();
    spinner.style.display = "block";
    if (container) {
        // Clear container and show spinner inside it
        container.innerHTML = "";
        container.appendChild(spinner);
    } else {
        // Handle showing spinner without a specific container if needed
        console.warn("showSpinner called without a container.");
    }
}

function hideSpinner() {
    const spinner = getSpinner();
    spinner.style.display = "none";
    // If the spinner was appended to a container that is now being replaced,
    // ensure it's removed or handled correctly by the function replacing the content.
    if (spinner.parentNode) {
        // spinner.parentNode.removeChild(spinner); // Or rely on innerHTML replacement
    }
}


// --- UI Initialization ---

function initializeUI() {
    setupSettingsIcon();
    // Any other one-time UI setup
}

// --- Settings Icon ---

function setupSettingsIcon() {
    const settingsIcon = getElement("settingsIcon");
    if (!settingsIcon) return; // Guard clause

    // Store the original source using a data attribute
    settingsIcon.setAttribute('data-original-src', settingsIcon.src);

    settingsIcon.addEventListener("mouseenter", function () {
        this.classList.add('rotating');
        this.src = '../../css/cog.png'; // Change to the cog icon path
    });

    settingsIcon.addEventListener("mouseleave", function () {
        const originalSrc = this.getAttribute('data-original-src');
        if (originalSrc) {
            this.src = originalSrc;
        }
        this.classList.remove('rotating');
    });

    // Note: The click listener's *action* (opening the window) remains triggered from popup.js
    // This keeps UI setup here, but the action separate.
    // Alternatively, you could have popup.js pass the action function: setupSettingsIcon(onSettingsClick)
    settingsIcon.addEventListener("click", handleSettingsClick); // We'll define handleSettingsClick in popup.js
}

// --- Dark Mode ---

function applyDarkMode() {
    chrome.storage.local.get("darkMode", function (data) {
        document.body.classList.remove("dark-mode", "light-mode", "very-dark-mode");
        const themePreference = data.darkMode || "dark"; // Default to dark

        if (themePreference === "dark") {
            document.body.classList.add("dark-mode");
        } else if (themePreference === "verydark") {
            document.body.classList.add("dark-mode"); // Base dark styles
            document.body.classList.add("very-dark-mode"); // Additive very dark styles
        } else { // light mode
            document.body.classList.add("light-mode");
        }
    });
}

// --- Login Button Display ---

function displayLoginButton(sessionExpired = false) {
    // Get the container meant for dynamic content
    const container = getElement("dynamicContentContainer");
    if (!container) {
        console.error("Dynamic content container (#dynamicContentContainer) not found!");
        return; // Cannot proceed
    }

    // Clear previous dynamic content (like old streams or messages)
    container.innerHTML = "";

    // Add session expired message if applicable
    if (sessionExpired) {
        const expirationMessage = document.createElement("div");
        expirationMessage.textContent = "Your session has expired. Please log in again.";
        expirationMessage.style.color = "#b41541"; // Or use CSS classes
        expirationMessage.style.marginBottom = "10px";
        expirationMessage.style.fontSize = "14px";
        expirationMessage.style.textAlign = "center"; // Center align message
        container.appendChild(expirationMessage);
    }

    // Create the login button
    const loginButton = document.createElement("button");
    loginButton.id = "loginButton";
    loginButton.textContent = "Login with Twitch";
    loginButton.addEventListener("click", handleLoginClick); // handleLoginClick is defined in popup.js
    container.appendChild(loginButton);

    // Create and append the description text
    const description = document.createElement("div");
    description.textContent = "Log in with Twitch to see live channels you follow!";
    description.id = "description"; // Keep ID if styles depend on it
    container.appendChild(description);

    // Create and append the not logged in icon
    const notLoggedInIcon = document.createElement("img");
    notLoggedInIcon.src = "../../css/notlogged.webp";
    notLoggedInIcon.alt = "Not Logged In";
    notLoggedInIcon.style.height = "auto"; // Adjust styling as needed
    notLoggedInIcon.style.maxWidth = "80%"; // Prevent oversized image
    notLoggedInIcon.style.marginTop = "50px";
    notLoggedInIcon.style.display = "block";
    notLoggedInIcon.style.marginLeft = "auto";
    notLoggedInIcon.style.marginRight = "auto";
    container.appendChild(notLoggedInIcon);

    // Ensure the container is visible (this is mainly handled by showDynamicContent in popup.js)
    container.style.display = 'block'; // Or 'flex' if you use flexbox for centering
}


// --- Live Streams Display ---

function updateLiveStreams(streamsData) {
    // Destructure the data passed from popup.js
    const {
        liveStreams = [],
        favoriteGroups = [],
        showAvatar = true,
        channelAccess = {},
        hideAccessedCount = false,
        streamGrouping = "none",
        showStreamTime = true,
        streamTitleDisplay = "hover",
        isInitialLoad = false  // Add this flag to track initial load state
    } = streamsData;

    // Get the container meant for dynamic content
    const container = getElement("dynamicContentContainer");
    if (!container) {
        console.error("Dynamic content container (#dynamicContentContainer) not found!");
        return; // Cannot proceed
    }

    // Optional: Add/remove a class for styling based on avatar presence if needed globally
    container.classList.toggle('with-avatar-layout', showAvatar); // Example class name

    // Store scroll position *of the dynamic container*
    const currentScrollPosition = container.scrollTop;

    // Clear previous dynamic content (old streams, 'no streams' message, login button, etc.)
    container.innerHTML = "";

    // Ensure the container is visible (mainly handled by showDynamicContent in popup.js)
    container.style.display = 'block';

    // --- Handle No Live Streams ---
    if (liveStreams.length === 0) {
        // Only show the "No followed channels" message if it's not the initial load
        if (!isInitialLoad) {
            const noStreamsMsg = document.createElement('div');
            noStreamsMsg.textContent = "No followed channels are currently live.";
            noStreamsMsg.style.padding = '20px';
            noStreamsMsg.style.textAlign = 'center';
            container.appendChild(noStreamsMsg);
        } else {
            // During initial load, show a loading indicator instead
            const loadingContainer = document.createElement('div');
            loadingContainer.style.padding = '20px';
            loadingContainer.style.textAlign = 'center';

            const loadingImg = document.createElement('img');
            loadingImg.src = "../../css/loading.webp";
            loadingImg.alt = "Loading...";
            loadingImg.style.width = '48px';
            loadingImg.style.height = '48px';

            const loadingText = document.createElement('div');
            loadingText.textContent = "Checking for live channels...";
            loadingText.style.marginTop = '10px';
            loadingText.style.fontSize = '12px';
            loadingText.style.color = '#999';

            loadingContainer.appendChild(loadingImg);
            loadingContainer.appendChild(loadingText);
            container.appendChild(loadingContainer);
        }

        // Restore scroll position (likely 0, but good practice)
        container.scrollTop = currentScrollPosition;
        return; // Exit early
    }

    // Rest of the function remains unchanged...
    // --- Sort Streams (Based on access count) ---
    liveStreams.sort(
        (a, b) =>
            (channelAccess[b.broadcasterLogin] || 0) -
            (channelAccess[a.broadcasterLogin] || 0)
    );

    let isAnyFavoriteGroupLive = false;

    // Sort favorite groups alphabetically before displaying them
    favoriteGroups.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    // --- Favorite Groups Section ---
    favoriteGroups.forEach((group) => {
        const liveGroupStreams = liveStreams.filter((stream) =>
            group.streamers
                .map((s) => s.toLowerCase())
                .includes(stream.channelName.toLowerCase())
        );

        if (liveGroupStreams.length > 0) {
            isAnyFavoriteGroupLive = true;
            const groupHeader = createCollapsibleHeader(group.name.toUpperCase());
            container.appendChild(groupHeader); // Append header directly to the dynamic container
            liveGroupStreams.forEach((stream) => {
                // Pass the dynamic container as the parent for the stream link
                appendStreamLink(stream, container, streamsData);
            });
        }
    });

    // --- Ungrouped Streams Section ---
    const ungroupedStreams = liveStreams.filter(
        (stream) =>
            !favoriteGroups.some((group) =>
                group.streamers
                    .map((s) => s.toLowerCase())
                    .includes(stream.channelName.toLowerCase())
            )
    );

    if (ungroupedStreams.length > 0) {
        if (streamGrouping === "game") {
            // Group by game
            const gameGroups = {};
            ungroupedStreams.forEach(stream => {
                const gameName = stream.category || "Other"; // Use "Other" for streams without a category
                if (!gameGroups[gameName]) gameGroups[gameName] = [];
                gameGroups[gameName].push(stream);
            });
            // Sort game names alphabetically
            const sortedGameNames = Object.keys(gameGroups).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            sortedGameNames.forEach((gameName) => {
                const gameHeader = createCollapsibleHeader(gameName.toUpperCase());
                container.appendChild(gameHeader); // Append header directly to the dynamic container
                gameGroups[gameName].forEach((stream) => {
                    // Pass the dynamic container as the parent for the stream link
                    appendStreamLink(stream, container, streamsData);
                });
            });

        } else {
            // Default grouping ("none" or if favorites exist)
            // Add "More Live Channels" header only if favorite groups were displayed
            if (isAnyFavoriteGroupLive) {
                const otherHeader = createCollapsibleHeader("MORE LIVE TWITCH CHANNELS");
                container.appendChild(otherHeader); // Append header directly to the dynamic container
            }
            // Append ungrouped streams
            ungroupedStreams.forEach((stream) => {
                // Pass the dynamic container as the parent for the stream link
                appendStreamLink(stream, container, streamsData);
            });
        }
    }

    // Add margin to the very last stream item or header for spacing at the bottom
    const lastElement = container.lastElementChild;
    if (lastElement && (lastElement.classList.contains('stream-item') || lastElement.classList.contains('group-header'))) {
        // It's often better to handle this with CSS using :last-child pseudo-class
        // e.g., #dynamicContentContainer > .stream-item:last-child { margin-bottom: 5px; }
        // lastElement.style.marginBottom = "5px"; // Avoid inline style if possible
    }

    // Restore scroll position *of the dynamic container*
    container.scrollTop = currentScrollPosition;
}

// --- Helper for Creating Collapsible Headers ---
function createCollapsibleHeader(text) {
    const header = document.createElement("h3");
    header.textContent = text;
    header.classList.add("group-header");
    header.addEventListener('click', function () {
        this.classList.toggle('collapsed');
        let nextElement = this.nextElementSibling;
        while (nextElement && !nextElement.classList.contains('group-header')) {
            nextElement.style.display = this.classList.contains('collapsed') ? 'none' : 'block';
            nextElement = nextElement.nextElementSibling;
        }
    });
    return header;
}


// --- Helper for Appending a Single Stream Link ---
function appendStreamLink(stream, container, streamSettings) {
    // Destructure settings needed within this function
    const { showAvatar, channelAccess, hideAccessedCount, showStreamTime, streamTitleDisplay } = streamSettings;

    const channelItem = document.createElement("div");
    channelItem.className = "stream-item";
    // --- Add contextmenu event listener ---
    channelItem.addEventListener("contextmenu", function (event) { // Using function() might be safer for 'this' if needed later, but arrow is fine too
        event.preventDefault(); // Prevent default browser context menu
        // Ensure showContextMenu is available before calling
        if (typeof showContextMenu === 'function') {
            showContextMenu(stream, event.pageX, event.pageY); // Call directly
        } else {
            console.error("showContextMenu is not defined! Check script order.");
        }
        return false; // Prevent further handling
    });

    const isRerun = stream.title.toLowerCase().includes("rerun");

    const channelLink = document.createElement("a");
    channelLink.href = `https://www.twitch.tv/${stream.broadcasterLogin}`;
    channelLink.className = "stream-info";
    channelLink.target = "_blank";
    channelLink.addEventListener("click", (event) => {
        event.preventDefault();
        // Call the logic handler from popup.js BEFORE opening the link
        handleStreamLinkClick(stream.broadcasterLogin, channelLink.href);
    });


    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "channel-category-wrapper";
    wrapperDiv.style.width = "100%";
    wrapperDiv.style.overflow = "hidden";

    const subWrapper = document.createElement("div"); // For channel name, category, viewers
    subWrapper.style.width = "100%";
    subWrapper.style.overflow = "hidden";

    let avatarImg = null; // Keep track if avatar is added

    // --- Avatar / Thumbnail ---
    if (showAvatar) {
        channelLink.classList.add("with-avatar"); // Base class if avatar enabled
        wrapperDiv.classList.add("channel-category-wrapper-with-avatar");
        subWrapper.className = "sub-wrapper-with-avatar";

        if (streamTitleDisplay === "newline" && stream.thumbnail) {
            avatarImg = document.createElement("img");
            avatarImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3E%3Crect width='30' height='30' fill='%2318181b'/%3E%3C/svg%3E"; // Dark placeholder
            const actualImage = new Image();
            actualImage.onload = () => { avatarImg.src = stream.thumbnail.replace('{width}', '30').replace('{height}', '30'); };
            actualImage.src = stream.thumbnail.replace('{width}', '30').replace('{height}', '30');
            avatarImg.className = "stream-thumbnail loading"; // Add loading class if you have CSS for it
            avatarImg.alt = `${stream.channelName}'s thumbnail`;
            subWrapper.classList.add("sub-wrapper-with-thumbnail", "sub-wrapper-newline");
        } else if (stream.avatar) {
            avatarImg = document.createElement("img");
            // Use a placeholder initially
            avatarImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3E%3Crect width='30' height='30' fill='%2318181b'/%3E%3C/svg%3E"; // Dark placeholder
            avatarImg.className = "stream-avatar loading"; // Add loading class

            // Load the actual avatar in the background
            const actualImage = new Image();
            actualImage.onload = () => {
                avatarImg.src = stream.avatar;
                avatarImg.classList.remove("loading");
            };
            actualImage.src = stream.avatar;

            Object.assign(avatarImg.style, { width: "30px", height: "30px", borderRadius: "15px", marginRight: "5px" });
        }

        if (avatarImg) {
            // Special handling for time overlay on thumbnail
            if (streamTitleDisplay === "newline" && stream.thumbnail && showStreamTime) {
                const thumbnailContainer = document.createElement("div");
                thumbnailContainer.style.position = "relative"; // For overlay positioning
                thumbnailContainer.appendChild(avatarImg);
                // Time span will be added later to this container
                channelLink.appendChild(thumbnailContainer);
            } else {
                channelLink.appendChild(avatarImg); // Append avatar/thumbnail directly
            }
        }
    }

    // --- Channel Name & Tooltip ---
    const channelNameSpan = document.createElement("span");
    channelNameSpan.className = "channel-name";
    channelNameSpan.textContent = stream.channelName;
    channelNameSpan.style.textAlign = "left"; // Ensure alignment

    const tooltipSpan = document.createElement("span");
    tooltipSpan.className = "custom-tooltip";
    tooltipSpan.textContent = stream.title;
    channelNameSpan.appendChild(tooltipSpan);

    // Tooltip positioning logic (can be complex, consider a library or CSS solution)
    channelNameSpan.addEventListener("mousemove", function (e) {
        const tooltipHeight = tooltipSpan.offsetHeight;
        const x = e.clientX;
        const y = e.clientY;
        const padding = 20; // Space from cursor
        const fromBottom = window.innerHeight - e.clientY;

        tooltipSpan.style.left = x + padding + "px";
        if (fromBottom < tooltipHeight + padding) { // Check space below cursor
            tooltipSpan.style.top = y - tooltipHeight - padding + "px"; // Place above
        } else {
            tooltipSpan.style.top = y + padding + "px"; // Place below
        }
    });

    // --- Category & Title (based on layout) ---
    const categoryDiv = document.createElement("div"); // Container for name/category/title text
    categoryDiv.style.textAlign = "left";
    categoryDiv.style.width = "100%";
    categoryDiv.style.overflow = "hidden";

    if (showAvatar && avatarImg) { // Layout when avatar is present
        channelNameSpan.classList.add("with-avatar");
        categoryDiv.appendChild(channelNameSpan); // Name first

        // Title (if newline mode)
        if (streamTitleDisplay === "newline") {
            const titleContainer = document.createElement("div");
            Object.assign(titleContainer.style, { width: "100%", overflow: "hidden", marginTop: "2px", maxWidth: "300px", position: "relative" }); // Adjust maxWidth as needed
            const titleSpan = document.createElement("span");
            titleSpan.className = "stream-title-display";
            titleSpan.textContent = stream.title;
            Object.assign(titleSpan.style, { display: "block", fontSize: "12px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", width: "100%", maxWidth: "100%" });
            titleContainer.appendChild(titleSpan);
            categoryDiv.appendChild(titleContainer);
        }

        // Category
        const categorySpan = document.createElement("span");
        categorySpan.className = "stream-category-with-avatar";
        categorySpan.textContent = stream.category;
        categorySpan.style.textAlign = "left";

        if (streamTitleDisplay === "newline") {
            Object.assign(categorySpan.style, { fontSize: "11px", display: "block", marginTop: "2px" });
            categorySpan.classList.add("newline-category"); // For specific CSS styling
        }
        categoryDiv.appendChild(categorySpan);
        subWrapper.appendChild(categoryDiv); // Add text block to sub-wrapper

    } else { // Layout without avatar
        wrapperDiv.appendChild(channelNameSpan); // Name directly in wrapper
        const categorySpan = document.createElement("span");
        categorySpan.className = "stream-category";
        categorySpan.textContent = stream.category;
        categorySpan.style.textAlign = "left";
        wrapperDiv.appendChild(categorySpan); // Category directly in wrapper
    }


    // --- Access Count Tooltip (if hidden) ---
    if (hideAccessedCount && avatarImg) {
        const accessCount = channelAccess[stream.broadcasterLogin] || 0;
        const accessTooltip = document.createElement("div");
        accessTooltip.className = "avatar-tooltip"; // Use CSS for styling
        accessTooltip.textContent = `Accessed: ${accessCount} times`;
        // Basic styling, prefer CSS
        Object.assign(accessTooltip.style, { position: "absolute", display: "none", padding: "5px", background: "rgba(0, 0, 0, 0.8)", color: "white", borderRadius: "3px", zIndex: "1000", pointerEvents: "none" }); // Important: pointerEvents none
        channelItem.appendChild(accessTooltip); // Append to item, easier to manage

        avatarImg.addEventListener("mouseover", (e) => {
            accessTooltip.style.display = "block";
        });
        avatarImg.addEventListener("mousemove", (e) => {
            // Position relative to the page, adjust as needed
            accessTooltip.style.left = e.pageX + 10 + "px";
            accessTooltip.style.top = e.pageY + 10 + "px";
        });
        avatarImg.addEventListener("mouseout", () => {
            accessTooltip.style.display = "none";
        });
    }


    // --- Viewers & Time Wrapper ---
    const viewersWrapper = document.createElement("div");
    viewersWrapper.className = showAvatar && avatarImg ? "viewers-wrapper-with-avatar" : "viewers-wrapper";
    Object.assign(viewersWrapper.style, { display: "flex", alignItems: "center", gap: "8px" }); // Use flex for alignment

    if (streamTitleDisplay === "newline" && showAvatar && avatarImg) { // Positioning for newline mode
        Object.assign(viewersWrapper.style, { position: "absolute", top: "8px", right: "5px" });
    }


    // --- Stream Time ---
    let timeSpan = null;
    if (showStreamTime) {
        timeSpan = document.createElement("span");
        timeSpan.className = "stream-time";
        timeSpan.style.fontSize = "12px";
        timeSpan.style.color = "#9CA3AF"; // Use CSS classes ideally
        timeSpan.textContent = formatStreamTime(stream.started_at); // Assumes formatStreamTime exists

        if (streamTitleDisplay === "newline" && showAvatar && avatarImg && stream.thumbnail) {
            timeSpan.classList.add("stream-time-overlay"); // Style overlay in CSS
            // Find the thumbnail container created earlier and append timeSpan to it
            const thumbContainer = channelLink.querySelector('div[style*="position: relative"]');
            if (thumbContainer) {
                thumbContainer.appendChild(timeSpan);
            }
        } else {
            viewersWrapper.appendChild(timeSpan); // Add time to the viewers wrapper
        }

        // Update time every second
        const timeInterval = setInterval(() => {
            if (timeSpan && timeSpan.isConnected) { // Check if element still exists
                timeSpan.textContent = formatStreamTime(stream.started_at);
            } else {
                clearInterval(timeInterval); // Stop if element removed
            }
        }, 1000);

        // Simple cleanup: Stop interval when the link is removed (might not be perfect)
        const observer = new MutationObserver((mutationsList, observerInstance) => {
            for (const mutation of mutationsList) {
                if (mutation.removedNodes) {
                    mutation.removedNodes.forEach(removedNode => {
                        if (removedNode === channelItem || removedNode.contains(channelItem)) {
                            clearInterval(timeInterval);
                            observerInstance.disconnect();
                            return;
                        }
                    });
                }
            }
        });
        observer.observe(container, { childList: true, subtree: true });
    }


    // --- Viewers Count ---
    const viewersSpan = document.createElement("span");
    viewersSpan.className = isRerun ? "viewers rerun" : "viewers";
    viewersSpan.textContent = formatViewerCount(stream.viewers); // Assumes formatViewerCount exists
    viewersWrapper.appendChild(viewersSpan);


    // --- Signal Icon ---
    if (showAvatar && avatarImg) {
        const iconImg = document.createElement("img");
        iconImg.src = isRerun
            ? "../../css/rerun.svg"
            : streamTitleDisplay === "newline"
                ? "../../css/signal-newline.svg"
                : "../../css/signal.svg";
        iconImg.className = "signal-icon";
        iconImg.alt = "Signal";
        Object.assign(iconImg.style, { height: "13px", width: "13px", marginLeft: showStreamTime ? "-15px" : "-13px" }); // Adjust spacing
        viewersWrapper.appendChild(iconImg);
    }


    // --- Assemble ---
    if (showAvatar && avatarImg) {
        subWrapper.appendChild(viewersWrapper); // Viewers go into sub-wrapper
        wrapperDiv.appendChild(subWrapper);     // Sub-wrapper goes into main wrapper
    } else {
        wrapperDiv.appendChild(viewersWrapper); // Viewers go directly into main wrapper
    }

    channelLink.appendChild(wrapperDiv); // Main wrapper goes into link
    channelItem.appendChild(channelLink); // Link goes into list item
    container.appendChild(channelItem);   // List item goes into main container
}


// --- Helper Functions ---

// --- Firefox Scrollbar Styling ---
function applyFirefoxScrollbarStyle() {
    if (navigator.userAgent.includes("Firefox")) {
        document.body.style.scrollbarWidth = "thin";
        // Consider setting color based on theme in applyDarkMode for consistency
        // document.body.style.scrollbarColor = "#6441a5 #efeff1"; // Example values
    }
}

// Apply styles on load
applyFirefoxScrollbarStyle();