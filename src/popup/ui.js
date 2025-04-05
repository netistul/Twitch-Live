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

/**
 * Main function to render streams based on current theme and display mode
 * @param {Object} stream - Stream data object
 * @param {HTMLElement} container - Container to append the stream item to
 * @param {Object} settings - Settings object with display preferences
 * @returns {HTMLElement} - The created stream item element
 */
function appendStreamLink(stream, container, settings) {
    // Extract relevant settings
    const {
        showAvatar,
        channelAccess,
        hideAccessedCount,
        showStreamTime,
        streamTitleDisplay
    } = settings;

    // Determine the current theme and display mode
    const theme = getCurrentTheme();
    const displayMode = getDisplayMode(showAvatar, streamTitleDisplay);

    // Create base channel item
    const channelItem = createBaseChannelItem(stream);

    // Apply theme and mode specific styling
    switch (displayMode) {
        case 'thumbnail':
            renderThumbnailMode(channelItem, stream, settings, theme);
            break;
        case 'with-avatar':
            renderAvatarMode(channelItem, stream, settings, theme);
            break;
        case 'no-avatar':
            renderNoAvatarMode(channelItem, stream, settings, theme);
            break;
    }

    // Add to container
    container.appendChild(channelItem);
    return channelItem;
}

/**
 * Get the current theme from body classes
 * @returns {string} - Current theme ('light', 'dark', or 'very-dark')
 */
function getCurrentTheme() {
    if (document.body.classList.contains('very-dark-mode')) {
        return 'very-dark';
    } else if (document.body.classList.contains('dark-mode')) {
        return 'dark';
    } else {
        return 'light';
    }
}

/**
 * Determine display mode based on settings
 * @param {boolean} showAvatar - Whether to show avatar
 * @param {string} streamTitleDisplay - How to display stream title
 * @returns {string} - Display mode ('thumbnail', 'with-avatar', or 'no-avatar')
 */
function getDisplayMode(showAvatar, streamTitleDisplay) {
    if (streamTitleDisplay === 'newline' && showAvatar) {
        return 'thumbnail';
    } else if (showAvatar) {
        return 'with-avatar';
    } else {
        return 'no-avatar';
    }
}

/**
 * Create the base channel item with common elements
 * @param {Object} stream - Stream data
 * @returns {HTMLElement} - Base channel item element
 */
function createBaseChannelItem(stream) {
    const channelItem = document.createElement("div");
    channelItem.className = "stream-item";

    // Add context menu event listener
    channelItem.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        if (typeof showContextMenu === 'function') {
            showContextMenu(stream, event.pageX, event.pageY);
        } else {
            console.error("showContextMenu is not defined! Check script order.");
        }
        return false;
    });

    // Create channel link element
    const channelLink = document.createElement("a");
    channelLink.href = `https://www.twitch.tv/${stream.broadcasterLogin}`;
    channelLink.className = "stream-info";
    channelLink.target = "_blank";
    channelLink.addEventListener("click", (event) => {
        event.preventDefault();
        handleStreamLinkClick(stream.broadcasterLogin, channelLink.href);
    });

    channelItem.appendChild(channelLink);

    // Store the link as a property for easy access
    channelItem.linkElement = channelLink;

    return channelItem;
}

/**
 * Render stream in thumbnail mode (newline with thumbnail)
 * @param {HTMLElement} channelItem - The channel item element
 * @param {Object} stream - Stream data
 * @param {Object} settings - Display settings
 * @param {string} theme - Current theme
 */
function renderThumbnailMode(channelItem, stream, settings, theme) {
    const { showStreamTime, channelAccess, hideAccessedCount } = settings;
    const isRerun = stream.title.toLowerCase().includes("rerun");
    const channelLink = channelItem.linkElement;

    // Add theme-specific classes
    channelItem.classList.add('thumbnail-mode');
    channelItem.classList.add(`thumbnail-${theme}`);
    channelLink.classList.add('with-avatar');

    // Create wrapper structure
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "channel-category-wrapper channel-category-wrapper-with-avatar";
    wrapperDiv.style.width = "100%";
    wrapperDiv.style.overflow = "hidden";

    const subWrapper = document.createElement("div");
    subWrapper.className = "sub-wrapper-with-avatar sub-wrapper-with-thumbnail sub-wrapper-newline";
    subWrapper.style.width = "100%";
    subWrapper.style.overflow = "hidden";

    // Create thumbnail container for overlay positioning
    const thumbnailContainer = document.createElement("div");
    thumbnailContainer.style.position = "relative";

    // Add thumbnail image
    const avatarImg = createThumbnailImage(stream);
    thumbnailContainer.appendChild(avatarImg);
    channelLink.appendChild(thumbnailContainer);

    // Create content block for channel name, title, category
    const categoryDiv = document.createElement("div");
    categoryDiv.style.textAlign = "left";
    categoryDiv.style.width = "100%";
    categoryDiv.style.overflow = "hidden";

    // Add channel name with tooltip
    const channelNameSpan = createChannelNameWithTooltip(stream);
    channelNameSpan.classList.add("with-avatar");
    categoryDiv.appendChild(channelNameSpan);

    // Add stream title
    const titleContainer = document.createElement("div");
    Object.assign(titleContainer.style, {
        width: "100%",
        overflow: "hidden",
        marginTop: "2px",
        maxWidth: "300px",
        position: "relative"
    });

    const titleSpan = document.createElement("span");
    titleSpan.className = "stream-title-display";
    titleSpan.textContent = stream.title;
    Object.assign(titleSpan.style, {
        display: "block",
        fontSize: "12px",
        textOverflow: "ellipsis",
        overflow: "hidden",
        whiteSpace: "nowrap",
        width: "100%",
        maxWidth: "100%"
    });

    titleContainer.appendChild(titleSpan);
    categoryDiv.appendChild(titleContainer);

    // Add category
    const categorySpan = document.createElement("span");
    categorySpan.className = "stream-category-with-avatar newline-category";
    categorySpan.textContent = stream.category;
    categorySpan.style.textAlign = "left";
    Object.assign(categorySpan.style, {
        fontSize: "11px",
        display: "block",
        marginTop: "2px"
    });

    categoryDiv.appendChild(categorySpan);
    subWrapper.appendChild(categoryDiv);

    // Create viewers and time section
    const viewersWrapper = createViewersWrapper(stream, true, 'newline');
    Object.assign(viewersWrapper.style, {
        position: "absolute",
        top: "8px",
        right: "5px"
    });

    // Add time overlay on thumbnail if needed
    if (showStreamTime) {
        const timeSpan = createTimeSpan(stream.started_at);
        timeSpan.classList.add("stream-time-overlay");
        thumbnailContainer.appendChild(timeSpan);
    }

    // Add viewers count and icon
    const viewersSpan = createViewersSpan(stream.viewers, isRerun);
    viewersWrapper.appendChild(viewersSpan);

    // Add signal icon
    const iconImg = document.createElement("img");
    iconImg.src = isRerun ? "../../css/rerun.svg" : "../../css/signal-newline.svg";
    iconImg.className = "signal-icon";
    iconImg.alt = "Signal";
    Object.assign(iconImg.style, {
        height: "13px",
        width: "13px",
        marginLeft: showStreamTime ? "-15px" : "-13px"
    });
    viewersWrapper.appendChild(iconImg);

    // Add hidden access count tooltip if needed
    if (hideAccessedCount) {
        addAccessCountTooltip(channelItem, avatarImg, stream.broadcasterLogin, channelAccess);
    }



    // Assemble components
    subWrapper.appendChild(viewersWrapper);
    wrapperDiv.appendChild(subWrapper);
    channelLink.appendChild(wrapperDiv);
}

/**
 * Render stream with avatar mode
 * @param {HTMLElement} channelItem - The channel item element
 * @param {Object} stream - Stream data
 * @param {Object} settings - Display settings
 * @param {string} theme - Current theme
 */
function renderAvatarMode(channelItem, stream, settings, theme) {
    const { showStreamTime, channelAccess, hideAccessedCount } = settings;
    const isRerun = stream.title.toLowerCase().includes("rerun");
    const channelLink = channelItem.linkElement;

    // Add theme-specific classes
    channelItem.classList.add('avatar-mode');
    channelItem.classList.add(`avatar-${theme}`);
    channelLink.classList.add('with-avatar');

    // Create wrapper structure
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "channel-category-wrapper channel-category-wrapper-with-avatar";
    wrapperDiv.style.width = "100%";
    wrapperDiv.style.overflow = "hidden";

    const subWrapper = document.createElement("div");
    subWrapper.className = "sub-wrapper-with-avatar";
    subWrapper.style.width = "100%";
    subWrapper.style.overflow = "hidden";

    // Add avatar
    const avatarImg = createAvatarImage(stream);
    channelLink.appendChild(avatarImg);

    // Create content block for channel name, category
    const categoryDiv = document.createElement("div");
    categoryDiv.style.textAlign = "left";
    categoryDiv.style.width = "100%";
    categoryDiv.style.overflow = "hidden";

    // Add channel name with tooltip
    const channelNameSpan = createChannelNameWithTooltip(stream);
    channelNameSpan.classList.add("with-avatar");
    categoryDiv.appendChild(channelNameSpan);

    // Add category
    const categorySpan = document.createElement("span");
    categorySpan.className = "stream-category-with-avatar";
    categorySpan.textContent = stream.category;
    categorySpan.style.textAlign = "left";
    categoryDiv.appendChild(categorySpan);

    subWrapper.appendChild(categoryDiv);

    // Create viewers and time section
    const viewersWrapper = createViewersWrapper(stream, true, 'avatar');

    // Add time if needed
    if (showStreamTime) {
        const timeSpan = createTimeSpan(stream.started_at);
        viewersWrapper.appendChild(timeSpan);
    }

    // Add viewers count and icon
    const viewersSpan = createViewersSpan(stream.viewers, isRerun);
    viewersWrapper.appendChild(viewersSpan);

    // Add signal icon
    const iconImg = document.createElement("img");
    iconImg.src = isRerun ? "../../css/rerun.svg" : "../../css/signal.svg";
    iconImg.className = "signal-icon";
    iconImg.alt = "Signal";
    Object.assign(iconImg.style, {
        height: "13px",
        width: "13px",
        marginLeft: showStreamTime ? "-15px" : "-13px"
    });
    viewersWrapper.appendChild(iconImg);

    // Add hidden access count tooltip if needed
    if (hideAccessedCount) {
        addAccessCountTooltip(channelItem, avatarImg, stream.broadcasterLogin, channelAccess);
    }

    // Apply theme-specific styling based on theme
    applyThemeSpecificStyles(channelItem, theme, 'avatar');

    // Assemble components
    subWrapper.appendChild(viewersWrapper);
    wrapperDiv.appendChild(subWrapper);
    channelLink.appendChild(wrapperDiv);
}

/**
 * Render stream with no avatar mode
 * @param {HTMLElement} channelItem - The channel item element
 * @param {Object} stream - Stream data
 * @param {Object} settings - Display settings
 * @param {string} theme - Current theme
 */
function renderNoAvatarMode(channelItem, stream, settings, theme) {
    const { showStreamTime } = settings;
    const isRerun = stream.title.toLowerCase().includes("rerun");
    const channelLink = channelItem.linkElement;

    // Add theme-specific classes
    channelItem.classList.add('no-avatar-mode');
    channelItem.classList.add(`no-avatar-${theme}`);

    // Create wrapper structure
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "channel-category-wrapper";
    wrapperDiv.style.width = "100%";
    wrapperDiv.style.overflow = "hidden";

    // Add channel name with tooltip
    const channelNameSpan = createChannelNameWithTooltip(stream);
    wrapperDiv.appendChild(channelNameSpan);

    // Add category
    const categorySpan = document.createElement("span");
    categorySpan.className = "stream-category";
    categorySpan.textContent = stream.category;
    categorySpan.style.textAlign = "left";
    wrapperDiv.appendChild(categorySpan);

    // Create viewers and time section
    const viewersWrapper = createViewersWrapper(stream, false, 'no-avatar');

    // Add time if needed
    if (showStreamTime) {
        const timeSpan = createTimeSpan(stream.started_at);
        viewersWrapper.appendChild(timeSpan);
    }

    // Add viewers count
    const viewersSpan = createViewersSpan(stream.viewers, isRerun);
    viewersWrapper.appendChild(viewersSpan);

    // Apply theme-specific styling
    applyThemeSpecificStyles(channelItem, theme, 'no-avatar');

    // Assemble components
    wrapperDiv.appendChild(viewersWrapper);
    channelLink.appendChild(wrapperDiv);
}

// --- Helper Functions ---

/**
 * Create an avatar image element
 * @param {Object} stream - Stream data
 * @returns {HTMLElement} - Avatar image element
 */
function createAvatarImage(stream) {
    const avatarImg = document.createElement("img");
    // Use a placeholder initially
    avatarImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3E%3Crect width='30' height='30' fill='%2318181b'/%3E%3C/svg%3E";
    avatarImg.className = "stream-avatar loading";

    // Load the actual avatar in the background
    const actualImage = new Image();
    actualImage.onload = () => {
        avatarImg.src = stream.avatar;
        avatarImg.classList.remove("loading");
    };
    actualImage.src = stream.avatar;

    Object.assign(avatarImg.style, {
        width: "30px",
        height: "30px",
        borderRadius: "15px",
        marginRight: "5px"
    });

    return avatarImg;
}

/**
 * Create a thumbnail image element
 * @param {Object} stream - Stream data
 * @returns {HTMLElement} - Thumbnail image element
 */
function createThumbnailImage(stream) {
    const avatarImg = document.createElement("img");
    avatarImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3E%3Crect width='30' height='30' fill='%2318181b'/%3E%3C/svg%3E";

    const actualImage = new Image();
    actualImage.onload = () => {
        avatarImg.src = stream.thumbnail.replace('{width}', '30').replace('{height}', '30');
    };
    actualImage.src = stream.thumbnail.replace('{width}', '30').replace('{height}', '30');

    avatarImg.className = "stream-thumbnail loading";
    avatarImg.alt = `${stream.channelName}'s thumbnail`;

    return avatarImg;
}

/**
 * Create channel name span with tooltip
 * @param {Object} stream - Stream data
 * @returns {HTMLElement} - Channel name span with tooltip
 */
function createChannelNameWithTooltip(stream) {
    const channelNameSpan = document.createElement("span");
    channelNameSpan.className = "channel-name";
    channelNameSpan.textContent = stream.channelName;
    channelNameSpan.style.textAlign = "left";

    const tooltipSpan = document.createElement("span");
    tooltipSpan.className = "custom-tooltip";
    tooltipSpan.textContent = stream.title;
    channelNameSpan.appendChild(tooltipSpan);

    // Tooltip positioning logic
    channelNameSpan.addEventListener("mousemove", function (e) {
        const tooltipHeight = tooltipSpan.offsetHeight;
        const x = e.clientX;
        const y = e.clientY;
        const padding = 20;
        const fromBottom = window.innerHeight - e.clientY;

        tooltipSpan.style.left = x + padding + "px";
        if (fromBottom < tooltipHeight + padding) {
            tooltipSpan.style.top = y - tooltipHeight - padding + "px";
        } else {
            tooltipSpan.style.top = y + padding + "px";
        }
    });

    return channelNameSpan;
}

/**
 * Create viewers wrapper element
 * @param {Object} stream - Stream data
 * @param {boolean} hasAvatar - Whether display has avatar
 * @param {string} displayMode - Display mode
 * @returns {HTMLElement} - Viewers wrapper element
 */
function createViewersWrapper(stream, hasAvatar, displayMode) {
    const viewersWrapper = document.createElement("div");
    viewersWrapper.className = hasAvatar ? "viewers-wrapper-with-avatar" : "viewers-wrapper";

    Object.assign(viewersWrapper.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px"
    });

    return viewersWrapper;
}

/**
 * Create time span for stream duration
 * @param {string} startTime - Stream start time
 * @returns {HTMLElement} - Time span element
 */
function createTimeSpan(startTime) {
    const timeSpan = document.createElement("span");
    timeSpan.className = "stream-time";
    timeSpan.style.fontSize = "12px";
    timeSpan.style.color = "#9CA3AF";
    timeSpan.textContent = formatStreamTime(startTime);

    // Update time every second
    const timeInterval = setInterval(() => {
        if (timeSpan && timeSpan.isConnected) {
            timeSpan.textContent = formatStreamTime(startTime);
        } else {
            clearInterval(timeInterval);
        }
    }, 1000);

    return timeSpan;
}

/**
 * Create viewers count span
 * @param {number} viewers - Number of viewers
 * @param {boolean} isRerun - Whether stream is a rerun
 * @returns {HTMLElement} - Viewers span element
 */
function createViewersSpan(viewers, isRerun) {
    const viewersSpan = document.createElement("span");
    viewersSpan.className = isRerun ? "viewers rerun" : "viewers";
    viewersSpan.textContent = formatViewerCount(viewers);
    return viewersSpan;
}

/**
 * Add access count tooltip to avatar
 * @param {HTMLElement} channelItem - Channel item element
 * @param {HTMLElement} avatarImg - Avatar image element
 * @param {string} broadcasterLogin - Broadcaster login name
 * @param {Object} channelAccess - Channel access data
 */
function addAccessCountTooltip(channelItem, avatarImg, broadcasterLogin, channelAccess) {
    const accessCount = channelAccess[broadcasterLogin] || 0;

    const accessTooltip = document.createElement("div");
    accessTooltip.className = "avatar-tooltip";
    accessTooltip.textContent = `Accessed: ${accessCount} times`;

    Object.assign(accessTooltip.style, {
        position: "absolute",
        display: "none",
        padding: "5px",
        background: "rgba(0, 0, 0, 0.8)",
        color: "white",
        borderRadius: "3px",
        zIndex: "1000",
        pointerEvents: "none"
    });

    channelItem.appendChild(accessTooltip);

    avatarImg.addEventListener("mouseover", () => {
        accessTooltip.style.display = "block";
    });

    avatarImg.addEventListener("mousemove", (e) => {
        accessTooltip.style.left = e.pageX + 10 + "px";
        accessTooltip.style.top = e.pageY + 10 + "px";
    });

    avatarImg.addEventListener("mouseout", () => {
        accessTooltip.style.display = "none";
    });
}

/**
 * Apply theme-specific styles to channel item
 * @param {HTMLElement} channelItem - Channel item element
 * @param {string} theme - Current theme
 * @param {string} displayMode - Display mode
 */
function applyThemeSpecificStyles(channelItem, theme, displayMode) {
    // Theme-specific styling
    if (theme === 'very-dark' && displayMode === 'thumbnail') {
        channelItem.style.borderBottom = "1px solid rgba(38, 38, 38, 1)";
        channelItem.style.paddingBottom = "8px";
        channelItem.style.marginBottom = "8px";
    }

    // Add more theme-specific styles here as needed
    switch (theme) {
        case 'light':
            // Light theme specific styles
            break;
        case 'dark':
            // Dark theme specific styles
            break;
        case 'very-dark':
            // Very dark theme specific styles beyond the border already added
            break;
    }

    // Display mode specific styling
    switch (displayMode) {
        case 'thumbnail':
            // Additional thumbnail mode styles
            break;
        case 'avatar':
            // Additional avatar mode styles
            break;
        case 'no-avatar':
            // Additional no-avatar mode styles
            break;
    }
}

/**
 * Helper function to add borders to the last stream in each group
 * Only needed for thumbnail mode in very-dark theme
 * @param {HTMLElement} container - Container element
 */
function addGroupBottomBorders(container) {
    const groupHeaders = container.querySelectorAll('.group-header');

    groupHeaders.forEach((header) => {
        // Find all stream items that belong to this group
        let currentElement = header.nextElementSibling;
        let lastStreamInGroup = null;

        // Traverse until we reach the next header or the end of the container
        while (currentElement && !currentElement.classList.contains('group-header')) {
            if (currentElement.classList.contains('stream-item')) {
                lastStreamInGroup = currentElement;
            }
            currentElement = currentElement.nextElementSibling;
        }

        // Add border to the last stream in the group
        if (lastStreamInGroup) {
            lastStreamInGroup.style.borderBottom = "1px solid rgba(38, 38, 38, 1)";
            lastStreamInGroup.style.paddingBottom = "8px";
            lastStreamInGroup.style.marginBottom = "8px";
        }
    });
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

/**
 * Modified updateLiveStreams to incorporate new theme system
 * @param {Object} streamsData - Stream data and settings
 */
function updateLiveStreams(streamsData) {
    // --- Destructuring and Initial Setup ---
    const {
        liveStreams = [],
        favoriteGroups = [],
        showAvatar = true,
        channelAccess = {},
        hideAccessedCount = false,
        streamGrouping = "none",
        showStreamTime = true,
        streamTitleDisplay = "hover",
        isInitialLoad = false,
        isPostAuth = false
    } = streamsData;

    const container = getElement("dynamicContentContainer");
    if (!container) {
        console.error("Dynamic content container (#dynamicContentContainer) not found!");
        return;
    }
    const currentTheme = getCurrentTheme();
    const currentScrollPosition = container.scrollTop;

    // Check if we have the "no streams" message and now have streams
    const noStreamsMsg = container.querySelector("#noStreamsMessage");
    if (noStreamsMsg && liveStreams.length > 0) {
        // Apply fade-out to the no streams message
        noStreamsMsg.classList.add('fade-out');

        // Wait for animation to complete before updating with streams
        setTimeout(() => {
            // Now proceed with the original updating logic
            updateStreamContent();
        }, 300); // Match this with CSS transition duration
    } else {
        // No need for transition, proceed immediately
        updateStreamContent();
    }

    // Function containing the original update logic
    function updateStreamContent() {
        // --- KEY CHANGE: Only clear container if we have streams or not in post-auth flow ---
        if (liveStreams.length > 0 || (!isPostAuth && !isInitialLoad)) {
            container.innerHTML = "";
        } else if (isPostAuth && container.querySelector("#loginLoadingContainer")) {
            // We're in post-auth flow with no streams yet - keep the loading indicator
            // Just update its text
            const loadingMsg = container.querySelector("#loginLoadingContainer div");
            if (loadingMsg) {
                loadingMsg.textContent = "Loading your streams...";
                container.scrollTop = currentScrollPosition;
                return; // Don't proceed with the rest of the function
            }
        }

        container.style.display = 'block';

        // --- Handle No Live Streams ---
        if (liveStreams.length === 0) {
            // Only show "no streams" message if we're not in post-auth or if explicit check was made
            if (!isPostAuth || !container.querySelector("#loginLoadingContainer")) {
                displayNoStreamsMessage(container);
            }
            container.scrollTop = currentScrollPosition;
            return;
        }

        // --- We have streams to display - if we still have a loading container, remove it ---
        const loadingContainer = container.querySelector("#loginLoadingContainer");
        if (loadingContainer) {
            loadingContainer.remove();
        }

        // --- Sort Streams (NO CHANGE HERE) ---
        liveStreams.sort(
            (a, b) =>
                (channelAccess[b.broadcasterLogin] || 0) -
                (channelAccess[a.broadcasterLogin] || 0)
        );
        let isAnyFavoriteGroupLive = false;
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

                const groupWrapper = document.createElement('div');
                groupWrapper.className = 'stream-group favorite-group';
                container.appendChild(groupWrapper);

                const groupHeader = createCollapsibleHeader(group.name.toUpperCase());
                groupWrapper.appendChild(groupHeader);

                liveGroupStreams.forEach((stream) => {
                    appendStreamLink(stream, groupWrapper, streamsData);
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
                    const gameName = stream.category || "Other";
                    if (!gameGroups[gameName]) gameGroups[gameName] = [];
                    gameGroups[gameName].push(stream);
                });

                const sortedGameNames = Object.keys(gameGroups).sort((a, b) =>
                    a.toLowerCase().localeCompare(b.toLowerCase())
                );

                sortedGameNames.forEach((gameName) => {
                    const groupWrapper = document.createElement('div');
                    groupWrapper.className = 'stream-group game-group';
                    container.appendChild(groupWrapper);

                    const gameHeader = createCollapsibleHeader(gameName.toUpperCase());
                    groupWrapper.appendChild(gameHeader);

                    const streamsInGameGroup = gameGroups[gameName];
                    streamsInGameGroup.forEach((stream) => {
                        appendStreamLink(stream, groupWrapper, streamsData);
                    });
                });
            } else {
                // Default grouping ("none" or if favorites exist)
                const groupWrapper = document.createElement('div');
                groupWrapper.className = 'stream-group ungrouped-group';
                container.appendChild(groupWrapper);

                if (isAnyFavoriteGroupLive) {
                    const otherHeader = createCollapsibleHeader("MORE LIVE TWITCH CHANNELS");
                    groupWrapper.appendChild(otherHeader);
                }

                ungroupedStreams.forEach((stream) => {
                    appendStreamLink(stream, groupWrapper, streamsData);
                });
            }
        }

        // Restore scroll position
        container.scrollTop = currentScrollPosition;
    }
}

/**
 * Display a message when no streams are available
 */
/**
 * Display a message when no streams are available with modern styling and animations
 * @param {HTMLElement} container - The container to display the message in
 * @param {boolean} isInitialLoad - Whether this is the initial popup load
 */
/**
 * Display a message when no streams are available with modern styling
 */
function displayNoStreamsMessage(container) {
    container.innerHTML = "";

    const noStreamsMsg = document.createElement("div");
    noStreamsMsg.className = "no-streams-message";
    noStreamsMsg.id = "noStreamsMessage"; // Add an ID to target it later
    noStreamsMsg.innerHTML = `
      <p>No followed channels are currently live.</p>
      <button id="refreshStreamsBtn">Refresh</button>
    `;

    container.appendChild(noStreamsMsg);

    // Add refresh button functionality
    const refreshBtn = document.getElementById("refreshStreamsBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", function () {
            this.textContent = "Refreshing...";
            this.disabled = true;
            refreshStreams();
        });
    }
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