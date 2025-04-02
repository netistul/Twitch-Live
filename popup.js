// == popup.js ==
(function () {
  "use strict";

  // --- Constants ---
  const UPDATE_INTERVAL_MS = 30000; // 30 seconds
  const OAUTH_REFRESH_INTERVAL_MS = 500;
  const OAUTH_REFRESH_DURATION_MS = 2000;
  const LOGIN_CHECK_DELAY_MS = 200;
  const RATE_LIMIT_CHECK_DELAY_MS = 1000;

  // --- DOM Element References ---
  // Cached static elements
  const DOMElements = {
    body: document.body,
    buttonContainer: document.getElementById("buttonContainer"),
    settingsIcon: document.getElementById("settingsIcon"),
    // Spinner is created dynamically when needed
  };

  // --- State (Implicitly managed via chrome.storage) ---
  // Holds the current scroll position to restore after updates
  let currentScrollPosition = 0;

  // --- Utility Functions ---

  /**
   * Formats the viewer count (e.g., 1.2k).
   * @param {number} count - The raw viewer count.
   * @returns {string} - The formatted viewer count string.
   */
  function formatViewerCount(count) {
    // Placeholder implementation - Replace with your actual logic
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "k";
    }
    return count.toString();
  }

  /**
   * Formats the stream uptime.
   * @param {string} startTimeISO - The ISO string when the stream started.
   * @returns {string} - The formatted uptime string (e.g., "1:23:45").
   */
  function formatStreamTime(startTimeISO) {
    // Placeholder implementation - Replace with your actual logic
    try {
      const startTime = new Date(startTimeISO);
      const now = new Date();
      const diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      const seconds = diffSeconds % 60;

      const paddedMinutes = String(minutes).padStart(2, "0");
      const paddedSeconds = String(seconds).padStart(2, "0");

      if (hours > 0) {
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
      } else {
        return `${minutes}:${paddedSeconds}`;
      }
    } catch (e) {
      console.error("Error formatting stream time:", e);
      return "??:??";
    }
  }

  /**
   * Shows a custom context menu for a stream item.
   * @param {object} stream - The stream data object.
   * @param {number} pageX - The horizontal coordinate of the click event.
   * @param {number} pageY - The vertical coordinate of the click event.
   */
  function showContextMenu(stream, pageX, pageY) {
    // Placeholder implementation - Replace with your actual logic
    console.log(
      `Context menu requested for ${stream.channelName} at (${pageX}, ${pageY})`
    );
    // Example: You would typically create a div element, populate it
    // with options based on the 'stream' object, position it using
    // pageX/pageY, and add event listeners to handle clicks on the options.
    // Remember to handle removing the context menu on clicks outside it.
    alert(`Right-clicked on ${stream.channelName}`); // Simple placeholder
  }

  /**
   * Initializes rate limit checks (if necessary).
   */
  function initRateLimitCheck() {
    // Placeholder - Integrate your actual rate limit checking logic if needed
    console.log("Rate limit check initialization (stub)");
  }

  /**
   * Applies specific scrollbar styling for Firefox.
   */
  function applyFirefoxScrollbarStyles() {
    if (navigator.userAgent.includes("Firefox")) {
      DOMElements.body.style.scrollbarWidth = "thin";
      DOMElements.body.style.scrollbarColor = "#6441a5 #efeff1"; // Example colors
    }
  }

  // --- Chrome Storage Interaction ---

  /**
   * Gets multiple items from chrome.storage.local.
   * @param {string[]} keys - Array of keys to retrieve.
   * @returns {Promise<object>} - A promise that resolves with the storage data.
   */
  function getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  /**
   * Sets an item in chrome.storage.local.
   * @param {object} items - An object with key/value pairs to store.
   * @returns {Promise<void>} - A promise that resolves when storage is set.
   */
  function setStorageData(items) {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, () => {
        resolve();
      });
    });
  }

  /**
   * Increments the access count for a specific channel.
   * @param {string} broadcasterLogin - The login name of the broadcaster.
   */
  async function incrementChannelAccess(broadcasterLogin) {
    const result = await getStorageData(["channelAccess"]);
    let channelAccess = result.channelAccess || {};
    channelAccess[broadcasterLogin] =
      (channelAccess[broadcasterLogin] || 0) + 1;
    await setStorageData({ channelAccess: channelAccess });
  }

  // --- UI Rendering Functions ---

  /**
   * Applies the selected theme (dark/light/verydark) to the body.
   */
  async function applyDarkMode() {
    const data = await getStorageData(["darkMode"]);
    const themePreference = data.darkMode || "dark"; // Default to dark

    // Reset theme classes first
    DOMElements.body.classList.remove(
      "dark-mode",
      "light-mode",
      "very-dark-mode"
    );

    // Apply appropriate theme
    if (themePreference === "dark") {
      DOMElements.body.classList.add("dark-mode");
    } else if (themePreference === "verydark") {
      DOMElements.body.classList.add("dark-mode", "very-dark-mode");
    } else {
      DOMElements.body.classList.add("light-mode");
    }
  }

  /**
   * Displays the login button and related messages.
   * @param {boolean} [sessionExpired=false] - Whether to show the session expired message.
   */
  function displayLoginButton(sessionExpired = false) {
    const container = DOMElements.buttonContainer;
    container.innerHTML = ""; // Clear previous content

    // Session Expired Message
    if (sessionExpired) {
      const expirationMessage = document.createElement("div");
      expirationMessage.textContent =
        "Your session has expired. Please log in again.";
      expirationMessage.style.color = "#b41541";
      expirationMessage.style.marginBottom = "10px";
      expirationMessage.style.fontSize = "14px";
      container.appendChild(expirationMessage);
    }

    // Login Button
    const loginButton = document.createElement("button");
    loginButton.id = "loginButton";
    loginButton.textContent = "Login with Twitch";
    loginButton.addEventListener("click", handleLoginClick);
    container.appendChild(loginButton);

    // Description
    const description = document.createElement("div");
    description.textContent =
      "Log in with Twitch to see live channels you follow!";
    description.id = "description";
    container.appendChild(description);

    // Not Logged In Icon
    const notLoggedInIcon = document.createElement("img");
    notLoggedInIcon.src = "css/notlogged.webp";
    notLoggedInIcon.alt = "Not Logged In";
    Object.assign(notLoggedInIcon.style, {
      height: "auto",
      marginTop: "10px",
      display: "block",
      marginLeft: "auto",
      marginRight: "auto",
    });
    container.appendChild(notLoggedInIcon);
  }

  /**
   * Creates and appends a single stream item element to the container.
   * @param {object} stream - The stream data object.
   * @param {HTMLElement} parentContainer - The container to append the stream item to.
   * @param {object} settings - An object containing user preferences (showAvatar, channelAccess, etc.).
   */
  function renderStreamItem(stream, parentContainer, settings) {
    const {
      showAvatar,
      channelAccess,
      hideAccessedCount,
      streamTitleDisplay,
      showStreamTime,
    } = settings;

    const channelItem = document.createElement("div");
    channelItem.className = "stream-item";
    channelItem.addEventListener("contextmenu", (event) =>
      handleStreamContextMenu(event, stream)
    );

    const isRerun = stream.title.toLowerCase().includes("rerun");

    const channelLink = document.createElement("a");
    channelLink.href = `https://www.twitch.tv/${stream.broadcasterLogin}`;
    channelLink.className = "stream-info";
    channelLink.target = "_blank";
    channelLink.addEventListener("click", (event) =>
      handleStreamClick(event, stream.broadcasterLogin)
    );

    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "channel-category-wrapper";
    wrapperDiv.style.width = "100%";
    wrapperDiv.style.overflow = "hidden";

    // Sub-wrapper for text content (channel, category, title)
    const subWrapper = document.createElement("div");
    subWrapper.style.width = "100%";
    subWrapper.style.overflow = "hidden";
    if (showAvatar) {
      subWrapper.classList.add("sub-wrapper-with-avatar");
      if (streamTitleDisplay === "newline" && stream.thumbnail) {
        subWrapper.classList.add("sub-wrapper-with-thumbnail");
      }
    }

    let avatarElement; // Can be avatar img, thumbnail img, or container for thumbnail+time

    // --- Avatar / Thumbnail ---
    if (showAvatar) {
      channelLink.classList.add("with-avatar");
      wrapperDiv.classList.add("channel-category-wrapper-with-avatar");

      if (streamTitleDisplay === "newline" && stream.thumbnail) {
        // Thumbnail logic
        const thumbImg = document.createElement("img");
        thumbImg.src =
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3E%3Crect width='30' height='30' fill='%2318181b'/%3E%3C/svg%3E"; // Placeholder
        thumbImg.className = "stream-thumbnail loading";
        thumbImg.alt = `${stream.channelName}'s thumbnail`;

        const actualImage = new Image();
        actualImage.onload = () => {
          thumbImg.src = stream.thumbnail
            .replace("{width}", "30")
            .replace("{height}", "30");
          thumbImg.classList.remove("loading");
        };
        actualImage.src = stream.thumbnail
          .replace("{width}", "30")
          .replace("{height}", "30");

        avatarElement = thumbImg; // Base element is the thumbnail

        if (showStreamTime) {
          // If showing time, wrap thumbnail and time in a container
          const thumbnailContainer = document.createElement("div");
          thumbnailContainer.style.position = "relative";
          thumbnailContainer.appendChild(thumbImg);

          const timeSpan = createStreamTimeElement(stream.started_at, parentContainer);
          timeSpan.classList.add("stream-time-overlay"); // Specific styling for overlay
          thumbnailContainer.appendChild(timeSpan);

          avatarElement = thumbnailContainer; // Container becomes the element to append
        }
      } else if (stream.avatar) {
        // Avatar logic
        const avatarImg = document.createElement("img");
        avatarImg.src = stream.avatar;
        avatarImg.className = "stream-avatar";
        avatarImg.alt = `${stream.channelName}'s avatar`;
        Object.assign(avatarImg.style, {
          width: "30px",
          height: "30px",
          borderRadius: "15px",
          marginRight: "5px",
        });
        avatarElement = avatarImg;

        // Add access count tooltip if enabled
        if (hideAccessedCount) {
          addAccessCountTooltip(avatarImg, channelAccess[stream.broadcasterLogin] || 0);
        }
      }

      if (avatarElement) {
        channelLink.appendChild(avatarElement);
      }
    }

    // --- Channel Name & Tooltip ---
    const channelNameSpan = document.createElement("span");
    channelNameSpan.className = "channel-name";
    channelNameSpan.textContent = stream.channelName;
    channelNameSpan.style.textAlign = "left";

    const tooltipSpan = document.createElement("span");
    tooltipSpan.className = "custom-tooltip";
    tooltipSpan.textContent = stream.title;
    channelNameSpan.appendChild(tooltipSpan);
    channelNameSpan.addEventListener("mousemove", handleTooltipMouseMove);

    // --- Category & Title (depends on settings) ---
    const categoryDiv = document.createElement("div"); // Container for category/title below name
    categoryDiv.style.textAlign = "left";
    categoryDiv.style.width = "100%";
    categoryDiv.style.overflow = "hidden";

    if (showAvatar && (stream.avatar || stream.thumbnail)) {
      // With Avatar: Name goes inside categoryDiv, then optional title, then category
      channelNameSpan.classList.add("with-avatar");
      categoryDiv.appendChild(channelNameSpan);

      // Stream Title (if newline)
      if (streamTitleDisplay === "newline") {
        const titleContainer = document.createElement("div");
        Object.assign(titleContainer.style, {
          width: "100%",
          overflow: "hidden",
          marginTop: "2px",
          maxWidth: "300px", // Adjust as needed
          position: "relative",
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
          maxWidth: "100%",
        });
        titleContainer.appendChild(titleSpan);
        categoryDiv.appendChild(titleContainer);
      }

      // Stream Category
      const categorySpan = document.createElement("span");
      categorySpan.textContent = stream.category;
      categorySpan.style.textAlign = "left";
      categorySpan.className = showAvatar
        ? "stream-category-with-avatar"
        : "stream-category";
      if (streamTitleDisplay === "newline") {
        categorySpan.style.fontSize = "11px";
        categorySpan.style.display = "block";
        categorySpan.style.marginTop = "2px";
        categorySpan.classList.add("newline-category");
      }
      categoryDiv.appendChild(categorySpan);
      subWrapper.appendChild(categoryDiv); // Add categoryDiv to subWrapper
    } else {
      // No Avatar: Name goes directly in wrapperDiv, then category
      wrapperDiv.appendChild(channelNameSpan);
      const categorySpan = document.createElement("span");
      categorySpan.className = "stream-category";
      categorySpan.textContent = stream.category;
      categorySpan.style.textAlign = "left";
      wrapperDiv.appendChild(categorySpan); // Add category directly to wrapperDiv
    }

    // --- Viewers, Time, Signal ---
    const viewersWrapper = document.createElement("div");
    viewersWrapper.className = showAvatar
      ? "viewers-wrapper-with-avatar"
      : "viewers-wrapper";
    Object.assign(viewersWrapper.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px", // Consistent gap
    });

    // Position viewers absolutely if newline mode
    if (streamTitleDisplay === "newline") {
      Object.assign(viewersWrapper.style, {
        position: "absolute",
        top: "11px", // Adjust as needed
        right: "5px",
      });
    }

    // Stream Time (if enabled and not already added as overlay)
    if (
      showStreamTime &&
      !(
        showAvatar &&
        streamTitleDisplay === "newline" &&
        stream.thumbnail
      )
    ) {
      const timeSpan = createStreamTimeElement(stream.started_at, parentContainer);
      viewersWrapper.appendChild(timeSpan); // Add to the viewers wrapper
    }

    // Viewers Count
    const viewersSpan = document.createElement("span");
    viewersSpan.className = isRerun ? "viewers rerun" : "viewers";
    viewersSpan.textContent = formatViewerCount(stream.viewers);
    viewersWrapper.appendChild(viewersSpan);

    // Signal Icon (if avatar shown)
    if (showAvatar && (stream.avatar || stream.thumbnail)) {
      const iconImg = document.createElement("img");
      iconImg.src = isRerun
        ? "css/rerun.svg"
        : streamTitleDisplay === "newline"
          ? "css/signal-newline.svg" // Thicker icon for newline
          : "css/signal.svg"; // Original red icon
      iconImg.className = "signal-icon";
      iconImg.alt = "Signal";
      Object.assign(iconImg.style, {
        height: "13px",
        width: "13px",
        marginLeft: showStreamTime ? "-15px" : "-13px", // Adjust spacing
      });
      viewersWrapper.appendChild(iconImg);
    }

    // Append viewers/time/signal wrapper
    if (showAvatar && (stream.avatar || stream.thumbnail)) {
      subWrapper.appendChild(viewersWrapper); // To subwrapper if avatar
    } else {
      wrapperDiv.appendChild(viewersWrapper); // To main wrapper if no avatar
    }

    // Assemble the main structure
    if (showAvatar && (stream.avatar || stream.thumbnail)) {
      wrapperDiv.appendChild(subWrapper); // Append subwrapper (name/cat/title + viewers)
    }
    // else: name/cat and viewers were already added directly to wrapperDiv

    channelLink.appendChild(wrapperDiv);
    channelItem.appendChild(channelLink);
    parentContainer.appendChild(channelItem);
  }


  /**
    * Creates the span element for displaying stream time and sets up its interval update.
    * @param {string} startTimeISO - The ISO start time of the stream.
    * @param {HTMLElement} mainContainer - The top-level container for MutationObserver.
    * @returns {HTMLElement} - The created time span element.
    */
  function createStreamTimeElement(startTimeISO, mainContainer) {
    const timeSpan = document.createElement("span");
    timeSpan.className = "stream-time";
    timeSpan.style.fontSize = "12px";
    timeSpan.style.color = "#9CA3AF"; // Example color
    timeSpan.textContent = formatStreamTime(startTimeISO);

    // Update the stream time every second
    const timeInterval = setInterval(() => {
      timeSpan.textContent = formatStreamTime(startTimeISO);
    }, 1000);

    // Use MutationObserver to clear interval when the element is removed from DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          // Check if the node itself or any descendant contains the timeSpan
          if (node === timeSpan || (node.contains && node.contains(timeSpan))) {
            clearInterval(timeInterval);
            observer.disconnect(); // Stop observing once cleaned up
            // console.log("Time interval cleared for:", startTimeISO); // For debugging
          }
        });
      });
    });

    // Observe the main container for changes in its descendants
    observer.observe(mainContainer, { childList: true, subtree: true });

    return timeSpan;
  }


  /**
   * Adds a tooltip showing access count on hover to an element.
   * @param {HTMLElement} element - The element to attach the tooltip listeners to.
   * @param {number} accessCount - The number of times accessed.
   */
  function addAccessCountTooltip(element, accessCount) {
    let tooltip = null; // Tooltip element reference

    element.addEventListener("mouseover", (e) => {
      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.className = "avatar-tooltip"; // Use class for styling
        tooltip.textContent = `Accessed: ${accessCount} times`;
        Object.assign(tooltip.style, {
          position: "absolute", // Use fixed if popup scrolls weirdly
          display: "none", // Initially hidden
          padding: "5px",
          background: "rgba(0, 0, 0, 0.8)",
          color: "white",
          borderRadius: "3px",
          fontSize: "11px",
          whiteSpace: "nowrap",
          zIndex: "1000",
          pointerEvents: "none", // Prevent tooltip from interfering with mouse events
        });
        DOMElements.body.appendChild(tooltip); // Append to body to avoid clipping
      }
      tooltip.style.display = "block";
      positionTooltip(e); // Initial position
    });

    element.addEventListener("mousemove", (e) => {
      if (tooltip) {
        positionTooltip(e);
      }
    });

    element.addEventListener("mouseout", () => {
      if (tooltip) {
        tooltip.style.display = "none";
      }
    });

    function positionTooltip(e) {
      const PADDING = 10;
      tooltip.style.left = e.pageX + PADDING + "px";
      tooltip.style.top = e.pageY + PADDING + "px";
      // Basic boundary check (optional, make more robust if needed)
      const rect = tooltip.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        tooltip.style.left = e.pageX - rect.width - PADDING + "px";
      }
      if (rect.bottom > window.innerHeight) {
        tooltip.style.top = e.pageY - rect.height - PADDING + "px";
      }
    }
  }

  /**
   * Creates a collapsible group header element.
   * @param {string} title - The text content for the header.
   * @returns {HTMLElement} - The created H3 element.
   */
  function createGroupHeader(title) {
    const header = document.createElement("h3");
    header.textContent = title.toUpperCase();
    header.classList.add("group-header");
    header.addEventListener("click", handleGroupHeaderClick);
    return header;
  }

  /**
   * Fetches live streams and settings, then updates the popup UI.
   */
  async function updateLiveStreamsUI() {
    const result = await getStorageData([
      "liveStreams",
      "favoriteGroups",
      "showAvatar",
      "channelAccess",
      "hideAccessedCount",
      "streamGrouping",
      "showStreamTime",
      "streamTitleDisplay",
    ]);

    const liveStreams = result.liveStreams || [];
    const favoriteGroups = result.favoriteGroups || [];
    const channelAccess = result.channelAccess || {};

    // Settings with defaults
    const settings = {
      showAvatar: result.showAvatar !== undefined ? result.showAvatar : true,
      hideAccessedCount: result.hideAccessedCount !== undefined ? result.hideAccessedCount : false,
      streamGrouping: result.streamGrouping || "none",
      showStreamTime: result.showStreamTime === "on", // Default false if not 'on'
      streamTitleDisplay: result.streamTitleDisplay || "hover",
      channelAccess: channelAccess,
    };

    // Sort streams by access count (descending)
    liveStreams.sort(
      (a, b) =>
        (channelAccess[b.broadcasterLogin] || 0) -
        (channelAccess[a.broadcasterLogin] || 0)
    );

    const container = DOMElements.buttonContainer;
    container.classList.toggle("with-avatar", settings.showAvatar);
    currentScrollPosition = container.scrollTop; // Store scroll position
    container.innerHTML = ""; // Clear previous content

    const scrollContainer = document.createElement("div");
    scrollContainer.id = "scrollContainer"; // Keep ID if needed for CSS

    let streamersInFavoriteGroups = new Set();
    let isAnyFavoriteGroupLive = false;

    // --- Render Favorite Groups ---
    favoriteGroups.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    ); // Sort groups alphabetically

    favoriteGroups.forEach((group) => {
      const liveGroupStreams = liveStreams.filter((stream) => {
        const isIncluded = group.streamers
          .map((s) => s.toLowerCase())
          .includes(stream.channelName.toLowerCase());
        if (isIncluded) {
          streamersInFavoriteGroups.add(stream.channelName.toLowerCase());
        }
        return isIncluded;
      });

      if (liveGroupStreams.length > 0) {
        isAnyFavoriteGroupLive = true;
        const groupHeader = createGroupHeader(group.name);
        scrollContainer.appendChild(groupHeader);
        liveGroupStreams.forEach((stream) =>
          renderStreamItem(stream, scrollContainer, settings)
        );
      }
    });

    // --- Render Ungrouped or Game-Grouped Streams ---
    const ungroupedStreams = liveStreams.filter(
      (stream) => !streamersInFavoriteGroups.has(stream.channelName.toLowerCase())
    );

    if (ungroupedStreams.length > 0) {
      if (settings.streamGrouping === "game") {
        // Group by Game
        const gameGroups = {};
        ungroupedStreams.forEach((stream) => {
          const gameName = stream.category || "Other"; // Group empty categories as "Other"
          if (!gameGroups[gameName]) gameGroups[gameName] = [];
          gameGroups[gameName].push(stream);
        });

        const sortedGameNames = Object.keys(gameGroups).sort();
        sortedGameNames.forEach((gameName) => {
          const gameHeader = createGroupHeader(gameName);
          scrollContainer.appendChild(gameHeader);
          gameGroups[gameName].forEach((stream) =>
            renderStreamItem(stream, scrollContainer, settings)
          );
        });
      } else {
        // No Game Grouping (or "none")
        if (isAnyFavoriteGroupLive) {
          // Add "More Channels" header only if favorite groups were shown
          const otherChannelsHeader = createGroupHeader(
            "MORE LIVE TWITCH CHANNELS"
          );
          scrollContainer.appendChild(otherChannelsHeader);
        }
        ungroupedStreams.forEach((stream) =>
          renderStreamItem(stream, scrollContainer, settings)
        );
      }
    }

    // Add bottom margin to the very last item for spacing
    if (scrollContainer.lastChild) {
      // Ensure last child is a stream item before adding margin
      if (scrollContainer.lastChild.classList.contains('stream-item')) {
        scrollContainer.lastChild.style.marginBottom = "5px";
      }
      // If last child is a header, find the last actual stream item
      else if (scrollContainer.lastChild.classList.contains('group-header')) {
        let current = scrollContainer.lastChild.previousElementSibling;
        while (current && !current.classList.contains('stream-item')) {
          current = current.previousElementSibling;
        }
        if (current) {
          current.style.marginBottom = "5px";
        }
      }
    }


    container.appendChild(scrollContainer);
    container.scrollTop = currentScrollPosition; // Restore scroll position
  }

  // --- Event Handlers ---

  /**
   * Handles the click event on the login button.
   */
  function handleLoginClick() {
    const container = DOMElements.buttonContainer;
    container.innerHTML = ""; // Clear button area

    // Create and show spinner
    const spinner = document.createElement("img");
    spinner.id = "spinner"; // Assign ID if needed for styling/selection
    spinner.src = "css/loading.webp";
    spinner.style.display = "block"; // Show it
    container.appendChild(spinner);

    // Send message to background script to start OAuth flow
    chrome.runtime.sendMessage({ action: "startOAuth" });
  }

  /**
   * Handles mouse enter event on the settings icon.
   */
  function handleSettingsMouseEnter() {
    const icon = DOMElements.settingsIcon;
    icon.classList.add("rotating");
    icon.setAttribute("data-original-src", icon.src); // Store original
    icon.src = "css/cog.png"; // Change to cog
  }

  /**
   * Handles mouse leave event on the settings icon.
   */
  function handleSettingsMouseLeave() {
    const icon = DOMElements.settingsIcon;
    const originalSrc = icon.getAttribute("data-original-src");
    if (originalSrc) {
      icon.src = originalSrc; // Restore original
    }
    icon.classList.remove("rotating");
  }

  /**
   * Handles click event on the settings icon.
   */
  function handleSettingsClick() {
    // Calculate desired window size
    const screenWidth = 700;
    // Ensure height doesn't exceed available screen height
    const screenHeight = Math.min(window.screen.availHeight, 880);

    window.open(
      "settings.html",
      "ExtensionSettings", // Window name (can be used to focus later)
      `width=${screenWidth},height=${screenHeight}` // Window features
    );
  }

  /**
   * Handles click event on a stream link.
   * Prevents default navigation, increments access count, then opens the link.
   * @param {Event} event - The click event object.
   * @param {string} broadcasterLogin - The login name of the streamer.
   */
  function handleStreamClick(event, broadcasterLogin) {
    event.preventDefault(); // Stop immediate navigation
    incrementChannelAccess(broadcasterLogin);

    // Delay opening the link slightly to allow storage update
    setTimeout(() => {
      window.open(event.currentTarget.href, "_blank");
    }, 10); // Small delay
  }

  /**
   * Handles context menu event on a stream item.
   * @param {Event} event - The contextmenu event object.
   * @param {object} stream - The stream data object associated with the item.
   */
  function handleStreamContextMenu(event, stream) {
    event.preventDefault(); // Prevent default browser context menu
    showContextMenu(stream, event.pageX, event.pageY);
    return false; // Prevent further handling (legacy)
  }

  /**
   * Handles mouse move event over channel names to position the title tooltip.
   * @param {MouseEvent} e - The mouse move event.
   */
  function handleTooltipMouseMove(e) {
    // 'this' refers to the channelNameSpan
    const tooltipSpan = this.querySelector(".custom-tooltip");
    if (!tooltipSpan) return;

    const tooltipHeight = tooltipSpan.offsetHeight;
    const PADDING = 10; // Space from cursor
    const x = e.clientX;
    const y = e.clientY;
    const spaceBelow = window.innerHeight - y;

    // Position tooltip above cursor if not enough space below
    if (spaceBelow < tooltipHeight + PADDING) {
      tooltipSpan.style.top = y - tooltipHeight - PADDING + "px";
    } else {
      tooltipSpan.style.top = y + PADDING + "px";
    }
    tooltipSpan.style.left = x + PADDING + "px";
  }

  /**
   * Handles clicks on group headers to toggle collapse state.
   */
  function handleGroupHeaderClick() {
    // 'this' refers to the clicked H3 header
    this.classList.toggle("collapsed");
    const isCollapsed = this.classList.contains("collapsed");

    // Iterate through sibling elements until the next header or end
    let nextElement = this.nextElementSibling;
    while (nextElement && !nextElement.classList.contains("group-header")) {
      nextElement.style.display = isCollapsed ? "none" : "block"; // Or flex/grid if needed
      nextElement = nextElement.nextElementSibling;
    }
  }

  /**
   * Handles messages from other parts of the extension (e.g., background script).
   * @param {object} message - The message object received.
   * @param {object} sender - Information about the script that sent the message.
   * @param {function} sendResponse - Function to send a response back.
   */
  function handleRuntimeMessages(message, sender, sendResponse) {
    if (message.action === "oauthComplete") {
      console.log("OAuth complete message received.");
      applyDarkMode(); // Re-apply dark mode in case it changed

      // Hide any lingering spinner (shouldn't be necessary if UI updates correctly)
      const spinner = document.getElementById("spinner");
      if (spinner) spinner.style.display = "none";

      // Trigger immediate UI update
      updateLiveStreamsUI();

      // Optional: Rapid refresh for a short period after login
      let refreshCount = 0;
      const maxRefreshes =
        OAUTH_REFRESH_DURATION_MS / OAUTH_REFRESH_INTERVAL_MS;
      const refreshInterval = setInterval(() => {
        updateLiveStreamsUI();
        refreshCount++;
        if (refreshCount >= maxRefreshes) {
          clearInterval(refreshInterval);
        }
      }, OAUTH_REFRESH_INTERVAL_MS);

      // Clean up interval just in case
      setTimeout(() => {
        clearInterval(refreshInterval);
      }, OAUTH_REFRESH_DURATION_MS + 100); // Add buffer
    }
    // Handle other messages if needed
  }

  // --- Initialization ---

  /**
   * Checks login status and displays either the login button or live streams.
   * This function now assumes the theme is already applied.
   */
  async function checkLoginAndRender() {
    try {
      // console.time("Get Login Storage"); // Optional timing
      const result = await getStorageData(["twitchAccessToken", "tokenExpired"]);
      // console.timeEnd("Get Login Storage"); // Optional timing

      if (!result.twitchAccessToken) {
        // console.time("Display Login Button Render"); // Optional timing
        displayLoginButton(result.tokenExpired || false);
        // console.timeEnd("Display Login Button Render"); // Optional timing
      } else {
        // console.time("Update Live Streams UI Render"); // Optional timing
        // Ensure updateLiveStreamsUI properly awaits its own storage calls if any
        await updateLiveStreamsUI();
        // console.timeEnd("Update Live Streams UI Render"); // Optional timing
      }
    } catch (error) {
      console.error("Error checking login status:", error);
      // Display error state
      DOMElements.buttonContainer.innerHTML = '<div class="error-message">Error loading data. Please try again.</div>';
      // Optionally display the login button as a fallback?
      // displayLoginButton(false);
    }
  }

  /**
  * Sets up all event listeners for the popup.
  */
  function initializeEventListeners() {
    // (Keep the event listener setup as it was)
    DOMElements.settingsIcon.addEventListener("mouseenter", handleSettingsMouseEnter);
    DOMElements.settingsIcon.addEventListener("mouseleave", handleSettingsMouseLeave);
    DOMElements.settingsIcon.addEventListener("click", handleSettingsClick);
    chrome.runtime.onMessage.addListener(handleRuntimeMessages);
  }

  /**
  * Main initialization function called when the popup DOM is ready.
  * NOW ASYNC to allow awaiting theme application.
  */
  async function initializePopup() {
    console.time("Popup Init Total"); // Start timing total init

    // --- 1. Render Initial Placeholder & Basic Styles ---
    console.time("Initial Setup");
    // Show a very basic loading state immediately
    DOMElements.buttonContainer.innerHTML = '<div class="loading-placeholder">Loading...</div>'; // Or a spinner
    applyFirefoxScrollbarStyles(); // Apply non-async styles
    initializeEventListeners(); // Setup static listeners
    console.timeEnd("Initial Setup");


    // --- 2. Apply Theme (Await this) ---
    console.time("Apply Dark Mode");
    try {
      await applyDarkMode(); // Wait for theme to be fully applied
      console.timeEnd("Apply Dark Mode");
    } catch (error) {
      console.error("Failed to apply dark mode:", error);
      console.timeEnd("Apply Dark Mode"); // End timer even on error
      // The popup will proceed with the default theme or potentially look wrong
    }

    // --- 3. Check Login & Render Main Content ---
    // Now that the theme is applied, we can render the actual content.
    // No need for the old LOGIN_CHECK_DELAY_MS timeout.
    console.time("Check Login and Render");
    // We don't necessarily need to 'await' this call here,
    // unless subsequent initialization steps depend on it finishing.
    // Let it run asynchronously to replace the placeholder.
    checkLoginAndRender().catch(error => {
      // Catch potential errors from the main render function itself
      console.error("Initial render failed:", error);
      // Ensure an error message is shown if checkLoginAndRender fails globally
      DOMElements.buttonContainer.innerHTML = '<div class="error-message">Failed to initialize streams.</div>';
    }).finally(() => {
      console.timeEnd("Check Login and Render"); // Log time when promise settles
    });


    // --- 4. Setup Periodic Updates & Other Delayed Tasks ---
    // These can start now, they don't need to wait for the initial render.
    console.time("Setup Intervals/Timers");
    setInterval(checkLoginAndRender, UPDATE_INTERVAL_MS);
    setTimeout(initRateLimitCheck, RATE_LIMIT_CHECK_DELAY_MS);
    console.timeEnd("Setup Intervals/Timers");

    console.timeEnd("Popup Init Total"); // End total init time (measures synchronous part + awaits)
  }

  // --- Entry Point ---
  // Wait for the DOM to be fully loaded before running initialization logic
  // The listener itself doesn't need to change.
  document.addEventListener("DOMContentLoaded", () => {
    initializePopup().catch(err => {
      console.error("Error during popup initialization:", err);
      // Display a fallback error in the UI if init fails badly
      const container = document.getElementById("buttonContainer");
      if (container) {
        container.innerHTML = '<div class="error-message">Critical error during initialization.</div>';
      }
    });
  });

})(); // End of IIFE