document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded event triggered");

  applyDarkMode();
  updateSettingsIcon();

  // Update live streams immediately for all users
  updateLiveStreams();

  // Delay checking login status to ensure smooth rendering
  setTimeout(checkLoginAndDisplayButton, 100);
  updateSettingsIcon();

  // Set an interval to update live streams and check login status every 30 seconds
  setInterval(function () {
    updateLiveStreams();
    setTimeout(checkLoginAndDisplayButton, 100);
  }, 30000);

  // Accessing buttonContainer & spinner element
  const buttonContainer = document.getElementById("buttonContainer");
  console.log("buttonContainer:", buttonContainer);

  // Create the spinner element for loading
  const spinner = document.createElement("img");
  spinner.id = "spinner";
  spinner.src = "css/loading.webp";
  spinner.style.display = "none";

  // Settings icon handling with hover effects
  const settingsIcon = document.getElementById("settingsIcon");
  let originalSrc = settingsIcon.src; // Store the original image source

  settingsIcon.addEventListener("mouseenter", function () {
    // Add rotation class
    this.classList.add('rotating');

    // Store the original source and change to emoji
    settingsIcon.setAttribute('data-original-src', settingsIcon.src);
    settingsIcon.src = 'css/cog.png'; // Change to the path of your settings/cog icon
    // Alternative: use emoji directly
    // this.outerHTML = '<div id="settingsIcon" class="rotating">⚙️</div>';
  });

  settingsIcon.addEventListener("mouseleave", function () {
    // Get original source and restore it
    const originalSrc = settingsIcon.getAttribute('data-original-src');
    if (originalSrc) {
      settingsIcon.src = originalSrc;
    }

    // Remove rotation class
    this.classList.remove('rotating');
  });

  // Settings click handler
  settingsIcon.addEventListener("click", function () {
    var screenWidth = 700;
    var screenHeight = Math.min(window.screen.availHeight, 880);

    window.open(
      "settings.html",
      "ExtensionSettings",
      "width=" + screenWidth + ",height=" + screenHeight
    );
  });

  // Listener for OAuth completion
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "oauthComplete") {
      applyDarkMode();
      spinner.style.display = "none"; // Hide the spinner

      // Start an interval to refresh every 500ms
      let refreshInterval = setInterval(updateLiveStreams, 500);

      // Stop refreshing after 2 seconds
      setTimeout(() => {
        clearInterval(refreshInterval);
      }, 2000);
    }
  });
});

function checkLoginAndDisplayButton() {
  chrome.storage.local.get(
    ["twitchAccessToken", "tokenExpired"],
    function (result) {
      if (!result.twitchAccessToken) {
        // result.tokenExpired will be undefined (falsy) if not set, which is equivalent to false
        displayLoginButton(result.tokenExpired); // This is safe; it will behave as if false if undefined
      } else {
        updateLiveStreams();
      }
    }
  );
}

function displayLoginButton(sessionExpired = false) {
  const buttonContainer = document.getElementById("buttonContainer");

  // Create the spinner element for loading
  const spinner = document.createElement("img");
  spinner.id = "spinner";
  spinner.src = "css/loading.webp";
  spinner.style.display = "none"; // Start hidden until needed

  // Create the login button
  const loginButton = document.createElement("button");
  loginButton.id = "loginButton";
  loginButton.textContent = "Login with Twitch";
  loginButton.addEventListener("click", function () {
    // Clear any previous content when login is initiated
    buttonContainer.innerHTML = "";
    spinner.style.display = "block"; // Show the spinner when login is initiated
    // Append spinner to the button container when the login button is clicked
    buttonContainer.appendChild(spinner);
    chrome.runtime.sendMessage({ action: "startOAuth" });
  });

  // Clear any previous content
  buttonContainer.innerHTML = "";

  // If the session has expired, display a notification message
  if (sessionExpired) {
    const expirationMessage = document.createElement("div");
    expirationMessage.textContent =
      "Your session has expired. Please log in again.";
    expirationMessage.style.color = "#b41541";
    expirationMessage.style.marginBottom = "10px";
    expirationMessage.style.fontSize = "14px";
    buttonContainer.appendChild(expirationMessage);
  }

  buttonContainer.appendChild(loginButton);

  // Create and append the description text
  const description = document.createElement("div");
  description.textContent =
    "Log in with Twitch to see live channels you follow!";
  description.id = "description";
  buttonContainer.appendChild(description);

  // Create and append the not logged in icon
  const notLoggedInIcon = document.createElement("img");
  notLoggedInIcon.src = "css/notlogged.webp";
  notLoggedInIcon.alt = "Not Logged In";
  notLoggedInIcon.style.height = "auto";
  notLoggedInIcon.style.marginTop = "10px";
  notLoggedInIcon.style.display = "block";
  notLoggedInIcon.style.marginLeft = "auto";
  notLoggedInIcon.style.marginRight = "auto";
  buttonContainer.appendChild(notLoggedInIcon);
}

function updateLiveStreams() {
  chrome.storage.local.get(
    [
      "liveStreams",
      "favoriteGroups",
      "showAvatar",
      "channelAccess",
      "hideAccessedCount",
      "streamGrouping",
      "showStreamTime",
      "streamTitleDisplay",
    ],
    function (result) {
      const liveStreams = result.liveStreams || [];
      const favoriteGroups = result.favoriteGroups || [];
      const showAvatar =
        result.showAvatar !== undefined ? result.showAvatar : true;
      const channelAccess = result.channelAccess || {};
      const hideAccessedCount =
        result.hideAccessedCount !== undefined
          ? result.hideAccessedCount
          : false;
      const streamGrouping = result.streamGrouping || "none";
      // Default to true

      // Sort channels based on access count
      liveStreams.sort(
        (a, b) =>
          (channelAccess[b.broadcasterLogin] || 0) -
          (channelAccess[a.broadcasterLogin] || 0)
      );

      const streamTitleDisplay = result.streamTitleDisplay || "hover";

      const container = document.getElementById("buttonContainer");
      const currentScrollPosition = container.scrollTop;
      container.innerHTML = "";

      const scrollContainer = document.createElement("div");
      scrollContainer.id = "scrollContainer";

      let isAnyFavoriteGroupLive = false; // This will track if any favorite group is live

      function appendStreamLink(stream, container) {
        const channelItem = document.createElement("div");
        channelItem.className = "stream-item";

        const channelLink = document.createElement("a");
        channelLink.href = `https://www.twitch.tv/${stream.broadcasterLogin}`;
        channelLink.className = "stream-info";
        channelLink.target = "_blank";

        channelLink.addEventListener("click", function (event) {
          event.preventDefault(); // Prevent the default link behavior immediately
          incrementChannelAccess(stream.broadcasterLogin);

          // Use setTimeout to delay the redirection
          setTimeout(() => {
            window.open(channelLink.href, "_blank");
          }, 10); // Delay in milliseconds, 10 is just an example
        });

        const wrapperDiv = document.createElement("div");
        wrapperDiv.className = "channel-category-wrapper";
        wrapperDiv.style.width = "100%";  // Add this
        wrapperDiv.style.overflow = "hidden";  // Add this

        // Sub-wrapper for channel name, category, and viewers
        const subWrapper = document.createElement("div");
        subWrapper.className = showAvatar ? "sub-wrapper-with-avatar" : "";
        subWrapper.style.width = "100%";  // Add this
        subWrapper.style.overflow = "hidden";  // Add this

        let avatarImg;
        if (showAvatar) {
          console.log('Stream Title Display:', streamTitleDisplay);
          console.log('Stream Thumbnail:', stream.thumbnail);
          console.log('Stream Avatar:', stream.avatar);

          if (streamTitleDisplay === "newline" && stream.thumbnail) {
            avatarImg = document.createElement("img");

            // Add dark placeholder while loading
            avatarImg.src = "css/dark-thumbnail-placeholder.svg"; // Dark themed placeholder
            avatarImg.style.backgroundColor = "#18181b"; // Twitch-like dark background

            // Load the actual image in the background
            const actualImage = new Image();
            actualImage.onload = () => {
              avatarImg.src = stream.thumbnail.replace('{width}', '30').replace('{height}', '30');
            };
            actualImage.src = stream.thumbnail.replace('{width}', '30').replace('{height}', '30');

            avatarImg.className = "stream-thumbnail loading";
            avatarImg.alt = `${stream.channelName}'s thumbnail`;
          }

          else if (stream.avatar) {
            console.log('Creating avatar element');
            avatarImg = document.createElement("img");
            avatarImg.src = stream.avatar;
            avatarImg.className = "stream-avatar";
            avatarImg.alt = `${stream.channelName}'s avatar`;
            avatarImg.style.width = "30px";
            avatarImg.style.height = "30px";
            avatarImg.style.borderRadius = "15px";
            avatarImg.style.marginRight = "5px";
            console.log('Avatar element created with src:', avatarImg.src);
          }

          if (avatarImg) {
            channelLink.appendChild(avatarImg);
            channelLink.classList.add("with-avatar");
            wrapperDiv.classList.add("channel-category-wrapper-with-avatar");
          }
        }

        const channelNameSpan = document.createElement("span");
        channelNameSpan.className = "channel-name";
        channelNameSpan.textContent = stream.channelName;
        channelNameSpan.style.textAlign = "left";

        // Create tooltip span and append it to channelNameSpan
        const tooltipSpan = document.createElement("span");
        tooltipSpan.className = "custom-tooltip";
        tooltipSpan.textContent = stream.title;
        channelNameSpan.appendChild(tooltipSpan);

        // Event listeners for showing and positioning the tooltip
        channelNameSpan.addEventListener("mousemove", function (e) {
          const tooltipHeight = tooltipSpan.offsetHeight;
          const x = e.clientX;
          const y = e.clientY;
          const padding = 10;
          const fromBottom = window.innerHeight - e.clientY;

          // Check if there is enough space at the bottom, if not show tooltip above the cursor
          if (fromBottom < tooltipHeight + padding) {
            tooltipSpan.style.top = y - tooltipHeight - padding + "px";
          } else {
            tooltipSpan.style.top = y + padding + "px";
          }

          tooltipSpan.style.left = x + padding + "px";
        });

        const categoryDiv = document.createElement("div");
        categoryDiv.style.textAlign = "left";

        if (showAvatar && stream.avatar) {
          channelNameSpan.classList.add("with-avatar");

          // Ensure proper width and containment for categoryDiv
          categoryDiv.style.width = "100%";
          categoryDiv.style.overflow = "hidden";
          categoryDiv.appendChild(channelNameSpan);

          const categorySpan = document.createElement("span");
          categorySpan.className = "stream-category-with-avatar";
          categorySpan.textContent = stream.category;
          categorySpan.style.textAlign = "left";

          // Add stream title first if the display option is set to "newline"
          if (streamTitleDisplay === "newline") {
            // Create a container for the title to ensure proper width constraints
            const titleContainer = document.createElement("div");
            Object.assign(titleContainer.style, {
              width: "100%",
              overflow: "hidden",
              marginTop: "2px",
              maxWidth: "300px", // Adjust this value based on your popup width
              position: "relative" // Ensure the container acts as a positioning context
            });

            const titleSpan = document.createElement("span");
            titleSpan.className = "stream-title-display";
            titleSpan.textContent = stream.title;

            Object.assign(titleSpan.style, {
              display: "block",
              fontSize: "12px",
              color: "#9CA3AF",
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
              width: "100%",
              maxWidth: "100%"
            });

            titleContainer.appendChild(titleSpan);
            categoryDiv.appendChild(titleContainer);
          }

          // Then add the category with smaller style if newline is enabled
          if (streamTitleDisplay === "newline") {
            categorySpan.style.fontSize = "11px";
            categorySpan.style.color = "#9CA3AF";
            categorySpan.style.display = "block";
            categorySpan.style.marginTop = "2px";
          }

          categoryDiv.appendChild(categorySpan);

          // Ensure subWrapper has proper width
          subWrapper.style.width = "100%";
          subWrapper.style.overflow = "hidden";
          subWrapper.appendChild(categoryDiv);
        } else {
          wrapperDiv.appendChild(channelNameSpan);
        }


        // Create the tooltip for the access count
        let tooltip;
        if (hideAccessedCount) {
          const accessCount = channelAccess[stream.broadcasterLogin] || 0;
          tooltip = document.createElement("div");
          tooltip.className = "avatar-tooltip";
          tooltip.textContent = `Accessed: ${accessCount} times`;
          tooltip.style.position = "absolute";
          tooltip.style.display = "none";
          tooltip.style.padding = "5px";
          tooltip.style.background = "rgba(0, 0, 0, 0.8)";
          tooltip.style.color = "white";
          tooltip.style.borderRadius = "3px";
          tooltip.style.zIndex = "1000";
          document.body.appendChild(tooltip);

          // Add hover event listeners to the avatar image
          if (avatarImg) {
            avatarImg.addEventListener("mouseover", function (e) {
              tooltip.style.display = "block";
              tooltip.style.left = e.pageX + 10 + "px";
              tooltip.style.top = e.pageY + 10 + "px";
            });

            avatarImg.addEventListener("mousemove", function (e) {
              tooltip.style.left = e.pageX + 10 + "px";
              tooltip.style.top = e.pageY + 10 + "px";
            });

            avatarImg.addEventListener("mouseout", function () {
              tooltip.style.display = "none";
            });
          }
        }

        if (!showAvatar || !stream.avatar) {
          const categorySpan = document.createElement("span");
          categorySpan.className = "stream-category";
          categorySpan.textContent = stream.category;
          categorySpan.style.textAlign = "left";
          wrapperDiv.appendChild(categorySpan);
        }

        const viewersWrapper = document.createElement("div");
        viewersWrapper.className = showAvatar
          ? "viewers-wrapper-with-avatar"
          : "viewers-wrapper";
        viewersWrapper.style.display = "flex";
        viewersWrapper.style.alignItems = "center";
        viewersWrapper.style.gap = "8px";

        // Add positioning for newline mode
        if (streamTitleDisplay === "newline") {
          viewersWrapper.style.position = "absolute";
          viewersWrapper.style.top = "11px";  // Align with the top where channel name is
          viewersWrapper.style.right = "5px"; // Keep some spacing from the right edge
        }

        const viewersSpan = document.createElement("span");
        viewersSpan.className = "viewers";
        viewersSpan.textContent = stream.viewers;

        const showStreamTime = result.showStreamTime === "on"; // Will be true only when explicitly "on"
        console.log('showStreamTime setting:', result.showStreamTime);
        console.log('showStreamTime after parsing:', showStreamTime);

        if (showStreamTime) {
          console.log('Creating time span because showStreamTime is:', showStreamTime);
          const timeSpan = document.createElement("span");
          timeSpan.className = "stream-time";
          timeSpan.style.fontSize = "12px";
          timeSpan.style.color = "#9CA3AF";
          timeSpan.textContent = formatStreamTime(stream.started_at);

          if (streamTitleDisplay === "newline" && stream.thumbnail) {
            timeSpan.classList.add("stream-time-overlay");
            const thumbnailContainer = document.createElement("div");
            thumbnailContainer.style.position = "relative";
            thumbnailContainer.appendChild(avatarImg);
            thumbnailContainer.appendChild(timeSpan);
            channelLink.appendChild(thumbnailContainer);
          }

          // Update the stream time every second
          const timeInterval = setInterval(() => {
            timeSpan.textContent = formatStreamTime(stream.started_at);
          }, 1000);

          // Clear interval when the element is removed
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.removedNodes.forEach((node) => {
                if (node.contains(timeSpan)) {
                  clearInterval(timeInterval);
                  observer.disconnect();
                }
              });
            });
          });
          observer.observe(container, { childList: true, subtree: true });
        }


        viewersWrapper.appendChild(viewersSpan);

        // Include signal icon if avatar is shown
        if (showAvatar && stream.avatar) {
          const iconImg = document.createElement("img");
          iconImg.src = "css/signal.svg";
          iconImg.className = "signal-icon";
          iconImg.alt = "Signal";
          iconImg.style.height = "13px";
          iconImg.style.width = "13px";
          // Use -15px when stream time is shown, -1px (from CSS) when hidden
          iconImg.style.marginLeft = showStreamTime ? "-15px" : "-13px";
          viewersWrapper.appendChild(iconImg);
        }


        if (showAvatar && stream.avatar) {
          subWrapper.appendChild(viewersWrapper);
          wrapperDiv.appendChild(subWrapper);
        } else {
          wrapperDiv.appendChild(viewersWrapper);
        }

        channelLink.appendChild(wrapperDiv);
        channelItem.appendChild(channelLink);

        // Add contextmenu event listener
        channelItem.addEventListener("contextmenu", function (event) {
          event.preventDefault(); // Prevent default browser context menu
          showContextMenu(stream, event.pageX, event.pageY);
          return false; // Prevent further handling
        });

        container.appendChild(channelItem);
      }

      // Sort favorite groups alphabetically before displaying them
      favoriteGroups.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );

      favoriteGroups.forEach((group) => {
        const liveGroupStreams = liveStreams.filter((stream) =>
          group.streamers
            .map((s) => s.toLowerCase())
            .includes(stream.channelName.toLowerCase())
        );

        if (liveGroupStreams.length > 0) {
          isAnyFavoriteGroupLive = true;

          const groupNameHeader = document.createElement("h3");
          groupNameHeader.textContent = group.name.toUpperCase();
          groupNameHeader.classList.add("group-header");
          scrollContainer.appendChild(groupNameHeader);

          liveGroupStreams.forEach((stream) => {
            appendStreamLink(stream, scrollContainer);
          });
        }
      });

      const ungroupedStreams = liveStreams.filter(
        (stream) =>
          !favoriteGroups.some((group) =>
            group.streamers
              .map((s) => s.toLowerCase())
              .includes(stream.channelName.toLowerCase())
          )
      );

      // If grouping by game is enabled
      if (streamGrouping === "game" && ungroupedStreams.length > 0) {
        // Group streams by game name
        const gameGroups = {};
        ungroupedStreams.forEach(stream => {
          const gameName = stream.category || "Other";
          if (!gameGroups[gameName]) {
            gameGroups[gameName] = [];
          }
          gameGroups[gameName].push(stream);
        });

        // Sort game names alphabetically
        const sortedGameNames = Object.keys(gameGroups).sort();

        // Create headers and add streams for each game group
        sortedGameNames.forEach((gameName, gameIndex) => {
          const gameHeader = document.createElement("h3");
          gameHeader.textContent = gameName.toUpperCase();
          gameHeader.classList.add("group-header");
          scrollContainer.appendChild(gameHeader);

          // Add all streams for this game
          gameGroups[gameName].forEach((stream, streamIndex) => {
            appendStreamLink(stream, scrollContainer);

            // Add margin to the last stream in the last game group
            if (gameIndex === sortedGameNames.length - 1 &&
              streamIndex === gameGroups[gameName].length - 1) {
              const lastStreamItem = scrollContainer.lastChild;
              lastStreamItem.style.marginBottom = "5px";
            }
          });
        });
      } else {
        // Original behavior remains the same
        if (ungroupedStreams.length > 0 && isAnyFavoriteGroupLive) {
          const otherChannelsHeader = document.createElement("h3");
          otherChannelsHeader.textContent = "MORE LIVE TWITCH CHANNELS";
          otherChannelsHeader.classList.add("group-header");
          scrollContainer.appendChild(otherChannelsHeader);
        }

        ungroupedStreams.forEach((stream, index) => {
          appendStreamLink(stream, scrollContainer);

          if (index === ungroupedStreams.length - 1) {
            const lastStreamItem = scrollContainer.lastChild;
            lastStreamItem.style.marginBottom = "5px";
          }
        });
      }

      container.appendChild(scrollContainer);
      container.scrollTop = currentScrollPosition;
    }
  );
}

// Function to format time as HH:MM:SS
function formatStreamTime(startTime) {
  const now = new Date();
  const start = new Date(startTime);
  const diffInSeconds = Math.floor((now - start) / 1000);

  const hours = Math.floor(diffInSeconds / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);
  const seconds = diffInSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function incrementChannelAccess(broadcasterLogin) {
  chrome.storage.local.get(["channelAccess"], function (result) {
    let channelAccess = result.channelAccess || {};
    channelAccess[broadcasterLogin] =
      (channelAccess[broadcasterLogin] || 0) + 1;
    chrome.storage.local.set({ channelAccess: channelAccess });
  });
}

// Function to update the settings icon based on user login status
function updateSettingsIcon() {
  const settingsIcon = document.getElementById("settingsIcon");

  chrome.storage.local.get(
    ["userAvatar", "twitchAccessToken"],
    function (result) {
      if (result.userAvatar && result.twitchAccessToken) {
        // User is logged in, update the settings icon to user's avatar
        settingsIcon.src = result.userAvatar;
      } else {
        // User is not logged in, use the default settings icon
        settingsIcon.src = "css/settings.png";
      }
    }
  );
}

// In popup.js to update avatar .png
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "profileUpdated") {
    // Update the settings icon when the profile is updated
    updateSettingsIcon();
  }
});

// When the popup opens
chrome.runtime.sendMessage({ popupOpen: true }, () => {
  if (chrome.runtime.lastError) {
    console.log("Error in sending message: ", chrome.runtime.lastError.message);
  } else {
    console.log("Popup open message sent");
  }
});

window.addEventListener("unload", function () {
  chrome.runtime.sendMessage({ popupOpen: false }, () => {
    if (chrome.runtime.lastError) {
      console.log(
        "Error in sending message: ",
        chrome.runtime.lastError.message
      );
    } else {
      console.log("Popup close message sent");
    }
  });
});

function applyDarkMode() {
  chrome.storage.local.get("darkMode", function (data) {
    // If no theme is set (data.darkMode is undefined), use dark mode
    const isDarkMode = !data.darkMode || data.darkMode === "dark";

    try {
      if (isDarkMode) {
        document.body.classList.add("dark-mode");
        document.body.classList.remove("light-mode");
      } else {
        document.body.classList.remove("dark-mode");
        document.body.classList.add("light-mode");
      }
      console.log(`Theme set to: ${isDarkMode ? 'dark' : 'light'} mode`);
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  });
}

/* Custom scrollbar for Firefox */
if (navigator.userAgent.includes("Firefox")) {
  document.body.style.scrollbarWidth = "thin";
  document.body.style.scrollbarColor = "#6441a5 #efeff1";
}

/* add to favorite list */
function showContextMenu(stream, x, y) {
  const existingMenu = document.querySelector(".custom-context-menu");
  if (existingMenu) {
    existingMenu.remove();
  }

  const contextMenu = document.createElement("div");
  contextMenu.className = "custom-context-menu";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  const menuHeader = document.createElement("div");
  menuHeader.className = "context-menu-header";

  const addActionText = document.createElement("span");
  addActionText.textContent = "Add ";
  addActionText.style.marginRight = "2px";
  addActionText.style.verticalAlign = "middle";

  const twitchIcon = document.createElement("img");
  twitchIcon.src = "css/twitch.png";
  twitchIcon.alt = "Twitch";
  twitchIcon.style.width = "15px";
  twitchIcon.style.marginRight = "2px";
  twitchIcon.style.verticalAlign = "middle";

  const channelNameSpan = document.createElement("span");
  channelNameSpan.textContent = `${stream.channelName}`;
  channelNameSpan.style.marginRight = "5px";
  channelNameSpan.style.verticalAlign = "middle";
  channelNameSpan.style.color = "#9182c1";

  const toFavoriteGroupText = document.createElement("span");
  toFavoriteGroupText.textContent = "to favorite list:";
  toFavoriteGroupText.style.verticalAlign = "middle";

  menuHeader.appendChild(addActionText);
  menuHeader.appendChild(twitchIcon);
  menuHeader.appendChild(channelNameSpan);
  menuHeader.appendChild(toFavoriteGroupText);
  contextMenu.appendChild(menuHeader);

  chrome.storage.local.get("favoriteGroups", function (data) {
    const groups = data.favoriteGroups || [];
    if (groups.length > 0) {
      groups.forEach((group, index) => {
        const menuItem = document.createElement("div");
        menuItem.className = "context-menu-item";
        menuItem.style.display = "flex";
        menuItem.style.alignItems = "center";
        menuItem.style.width = "100%";
        menuItem.style.position = "relative";
        menuItem.style.padding = "6px 8px";

        const checkBox = document.createElement("input");
        checkBox.type = "checkbox";
        checkBox.checked = group.streamers.includes(stream.channelName);
        checkBox.style.marginRight = "8px";

        // Create container for group name and actions
        const groupContainer = document.createElement("div");
        groupContainer.style.position = "relative";
        groupContainer.style.flex = "1";
        groupContainer.style.minWidth = "0"; // Enables text truncation
        groupContainer.style.display = "flex";
        groupContainer.style.alignItems = "center";

        const groupNameSpan = document.createElement("span");
        groupNameSpan.className = "group-name";
        groupNameSpan.textContent = group.name;
        groupNameSpan.style.overflow = "hidden";
        groupNameSpan.style.textOverflow = "ellipsis";
        groupNameSpan.style.whiteSpace = "nowrap";
        groupNameSpan.style.flex = "1";
        groupNameSpan.style.minWidth = "0";
        groupNameSpan.style.padding = "2px 4px";
        groupNameSpan.style.borderRadius = "4px";

        // Create actions container
        const actionsContainer = document.createElement("div");
        actionsContainer.style.display = "none"; // Hidden by default
        actionsContainer.style.alignItems = "center";
        actionsContainer.style.marginLeft = "8px";
        actionsContainer.style.whiteSpace = "nowrap"; // Prevent buttons from wrapping

        const editButton = document.createElement("button");
        editButton.textContent = "✏️";
        editButton.className = "edit-group-btn";

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "🗑️";
        deleteButton.className = "delete-group-button";
        deleteButton.title = "Delete";

        // Build the DOM structure
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(deleteButton);
        groupContainer.appendChild(groupNameSpan);
        groupContainer.appendChild(actionsContainer);
        menuItem.appendChild(checkBox);
        menuItem.appendChild(groupContainer);

        // Function to handle entering edit mode
        const enterEditMode = () => {
          // Remove text truncation and allow the full text to be shown while editing
          groupNameSpan.style.whiteSpace = "normal"; // Allow the text to wrap if needed
          groupNameSpan.style.overflow = "visible";  // Allow the text to overflow
          groupNameSpan.style.textOverflow = "unset"; // Remove ellipsis truncation

          groupNameSpan.contentEditable = true;
          groupNameSpan.classList.add("editing");
          groupNameSpan.style.textAlign = "left";
          groupNameSpan.style.display = "inline-block";
          groupNameSpan.style.width = "fit-content";
          groupNameSpan.focus();

          // Set cursor at the end
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(groupNameSpan);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);

          const originalName = groupNameSpan.textContent;

          const saveEdit = () => {
            const newName = groupNameSpan.textContent.trim();
            if (newName && newName !== originalName) {
              chrome.storage.local.get("favoriteGroups", function (data) {
                const groups = data.favoriteGroups || [];
                if (groups[index]) {
                  groups[index].name = newName;
                  chrome.storage.local.set({ favoriteGroups: groups }, function () {
                    console.log("Group name updated:", newName);
                    updateLiveStreams()
                  });
                }
              });
            } else if (!newName) {
              groupNameSpan.textContent = originalName;
            }

            groupNameSpan.contentEditable = false;
            groupNameSpan.classList.remove("editing");
            groupNameSpan.style.backgroundColor = "";

            // Reapply truncation after editing
            groupNameSpan.style.whiteSpace = "nowrap"; // Restore truncation after editing
            groupNameSpan.style.overflow = "hidden";
            groupNameSpan.style.textOverflow = "ellipsis"; // Re-enable ellipsis truncation
          };

          groupNameSpan.onkeydown = function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveEdit();
              groupNameSpan.blur();
            } else if (e.key === 'Escape') {
              groupNameSpan.textContent = originalName;
              groupNameSpan.contentEditable = false;
              groupNameSpan.classList.remove("editing");
              groupNameSpan.style.backgroundColor = "";
              groupNameSpan.style.whiteSpace = "nowrap";
              groupNameSpan.blur();
            }
          };

          groupNameSpan.onblur = saveEdit;
        };


        // Show/hide actions on hover
        menuItem.addEventListener('mouseenter', () => {
          actionsContainer.style.display = "flex";
        });

        menuItem.addEventListener('mouseleave', () => {
          actionsContainer.style.display = "none";
        });

        // Event handlers
        groupNameSpan.onclick = enterEditMode;
        editButton.onclick = (e) => {
          e.stopPropagation();
          enterEditMode();
        };

        deleteButton.onclick = function (event) {
          event.stopPropagation();
          deleteGroup(index, contextMenu);
        };

        // Only trigger checkbox when clicking on non-editable areas
        menuItem.addEventListener("click", function (event) {
          if (!groupNameSpan.contains(event.target) && !editButton.contains(event.target) && !deleteButton.contains(event.target) && event.target !== checkBox) {
            checkBox.checked = !checkBox.checked;
            checkBox.dispatchEvent(new Event("change"));
          }
        });

        checkBox.addEventListener("change", function () {
          if (checkBox.checked) {
            addToGroup(stream, group.name);
          } else {
            removeFromGroup(stream, group.name);
          }
        });

        contextMenu.appendChild(menuItem);
      });
    } else {
      const noGroupItem = document.createElement("div");
      noGroupItem.textContent = "No favorite groups found.";
      noGroupItem.className = "context-menu-item";
      contextMenu.appendChild(noGroupItem);
    }

    const addNewGroupItem = document.createElement("div");
    addNewGroupItem.textContent = "➕ Add new favorite list";
    addNewGroupItem.className = "context-menu-item add-new-group-button";
    addNewGroupItem.onclick = function () {
      openAddGroupForm(contextMenu, stream);
    };

    contextMenu.appendChild(addNewGroupItem);
    document.body.appendChild(contextMenu);

    const menuRect = contextMenu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      contextMenu.style.left = `${window.innerWidth - menuRect.width}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
      contextMenu.style.top = `${window.innerHeight - menuRect.height}px`;
    }
  });

  document.addEventListener(
    "click",
    function closeMenu(event) {
      if (!contextMenu.contains(event.target)) {
        contextMenu.remove();
        document.removeEventListener("click", closeMenu);
      }
    },
    { capture: true }
  );
}

function addToGroup(stream, groupName) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    const groups = data.favoriteGroups || [];
    const group = groups.find((g) => g.name === groupName);
    if (group && !group.streamers.includes(stream.channelName)) {
      // Check using channelName
      group.streamers.push(stream.channelName);
      chrome.storage.local.set({ favoriteGroups: groups }, function () {
        console.log(`Added ${stream.channelName} to ${groupName}`);
        updateLiveStreams();
      });
    }
  });
}

function removeFromGroup(stream, groupName) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    const groups = data.favoriteGroups || [];
    const group = groups.find((g) => g.name === groupName);
    if (group) {
      group.streamers = group.streamers.filter((s) => s !== stream.channelName);
      chrome.storage.local.set({ favoriteGroups: groups }, function () {
        console.log(`Removed ${stream.channelName} from ${groupName}`);
        updateLiveStreams();
      });
    }
  });
}

function createNewGroup(groupName, stream, contextMenu) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    const groups = data.favoriteGroups || [];
    if (!groups.some((g) => g.name === groupName)) {
      const newGroup = {
        name: groupName,
        streamers: [stream.channelName],
      };
      groups.push(newGroup);
      chrome.storage.local.set({ favoriteGroups: groups }, function () {
        console.log(`New group '${groupName}' created and added ${stream.channelName}`);
        updateLiveStreams();

        const menuItem = document.createElement("div");
        menuItem.className = "context-menu-item";
        menuItem.style.display = "flex";
        menuItem.style.alignItems = "center";
        menuItem.style.width = "100%";
        menuItem.style.position = "relative";

        const checkBox = document.createElement("input");
        checkBox.type = "checkbox";
        checkBox.checked = true;
        checkBox.style.marginRight = "8px";

        // Create container for group name and actions
        const groupContainer = document.createElement("div");
        groupContainer.style.position = "relative";
        groupContainer.style.flex = "1";
        groupContainer.style.minWidth = "0";
        groupContainer.style.display = "flex";
        groupContainer.style.alignItems = "center";

        const groupNameSpan = document.createElement("span");
        groupNameSpan.className = "group-name";
        groupNameSpan.textContent = groupName;
        groupNameSpan.style.overflow = "hidden";
        groupNameSpan.style.textOverflow = "ellipsis";
        groupNameSpan.style.whiteSpace = "nowrap";
        groupNameSpan.style.flex = "1";
        groupNameSpan.style.minWidth = "0";
        groupNameSpan.style.padding = "2px 4px";
        groupNameSpan.style.borderRadius = "4px";

        // Create actions container
        const actionsContainer = document.createElement("div");
        actionsContainer.style.display = "none";
        actionsContainer.style.alignItems = "center";
        actionsContainer.style.marginLeft = "8px";
        actionsContainer.style.whiteSpace = "nowrap";

        // Create edit button
        const editButton = document.createElement("button");
        editButton.textContent = "✏️";
        editButton.className = "edit-group-btn";

        // Create delete button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "🗑️";
        deleteButton.className = "delete-group-button";
        deleteButton.title = "Delete";

        // Add buttons to actions container
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(deleteButton);

        // Build the DOM structure
        groupContainer.appendChild(groupNameSpan);
        groupContainer.appendChild(actionsContainer);
        menuItem.appendChild(checkBox);
        menuItem.appendChild(groupContainer);

        // Add edit functionality
        const enterEditMode = () => {
          // Remove text truncation and allow the full text to be shown while editing
          groupNameSpan.style.whiteSpace = "normal"; // Allow the text to wrap if needed
          groupNameSpan.style.overflow = "visible";  // Allow the text to overflow
          groupNameSpan.style.textOverflow = "unset"; // Remove ellipsis truncation

          groupNameSpan.contentEditable = true;
          groupNameSpan.classList.add("editing");
          groupNameSpan.focus();

          const originalName = groupNameSpan.textContent;

          const saveEdit = () => {
            const newName = groupNameSpan.textContent.trim();
            if (newName && newName !== originalName) {
              chrome.storage.local.get("favoriteGroups", function (data) {
                const groups = data.favoriteGroups || [];
                if (groups[groups.length - 1]) {
                  groups[groups.length - 1].name = newName;
                  chrome.storage.local.set({ favoriteGroups: groups }, function () {
                    console.log("Group name updated:", newName);
                    updateLiveStreams();
                  });
                }
              });
            } else if (!newName) {
              groupNameSpan.textContent = originalName;
            }

            groupNameSpan.contentEditable = false;
            groupNameSpan.classList.remove("editing");
            groupNameSpan.style.backgroundColor = "";

            // Reapply truncation after editing
            groupNameSpan.style.whiteSpace = "nowrap"; // Restore truncation after editing
            groupNameSpan.style.overflow = "hidden";
            groupNameSpan.style.textOverflow = "ellipsis"; // Re-enable ellipsis truncation
          };

          groupNameSpan.onkeydown = function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveEdit();
              groupNameSpan.blur();
            } else if (e.key === 'Escape') {
              groupNameSpan.textContent = originalName;
              groupNameSpan.contentEditable = false;
              groupNameSpan.classList.remove("editing");
              groupNameSpan.style.backgroundColor = "";
              groupNameSpan.style.whiteSpace = "nowrap";
              groupNameSpan.blur();
            }
          };

          groupNameSpan.onblur = saveEdit;
        };

        // Event handlers
        menuItem.addEventListener('mouseenter', () => {
          actionsContainer.style.display = "flex";
        });

        menuItem.addEventListener('mouseleave', () => {
          actionsContainer.style.display = "none";
        });

        groupNameSpan.onclick = enterEditMode;
        editButton.onclick = (e) => {
          e.stopPropagation();
          enterEditMode();
        };

        deleteButton.onclick = function (event) {
          event.stopPropagation();
          deleteGroup(groups.length - 1, contextMenu);
        };

        menuItem.addEventListener("click", function (event) {
          if (!groupNameSpan.contains(event.target) &&
            !editButton.contains(event.target) &&
            !deleteButton.contains(event.target) &&
            event.target !== checkBox) {
            checkBox.checked = !checkBox.checked;
            checkBox.dispatchEvent(new Event("change"));
          }
        });

        checkBox.addEventListener("change", function () {
          if (checkBox.checked) {
            addToGroup(stream, groupName);
          } else {
            removeFromGroup(stream, groupName);
          }
        });

        contextMenu.insertBefore(menuItem, contextMenu.lastChild);
      });
    } else {
      alert("A group with this name already exists.");
    }
  });
}


function openAddGroupForm(contextMenu, stream) {
  // Create form container if it doesn't exist
  let formContainer = contextMenu.querySelector(".new-group-form");
  if (!formContainer) {
    formContainer = document.createElement("div");
    formContainer.className = "new-group-form";

    // Create input for group name
    const groupNameInput = document.createElement("input");
    groupNameInput.type = "text";
    groupNameInput.placeholder = "Enter new group name";
    groupNameInput.className = "group-name-input";

    // Create submit button
    const submitButton = document.createElement("button");
    submitButton.textContent = "Submit";
    submitButton.className = "submit-new-group";

    // Append elements to the form container
    formContainer.appendChild(groupNameInput);
    formContainer.appendChild(submitButton);

    // Append the form to the context menu before the add new group item
    const addNewGroupButton = contextMenu.querySelector(
      ".add-new-group-button"
    ); // Ensure this class is set correctly where the button is created
    contextMenu.insertBefore(formContainer, addNewGroupButton);

    // Focus on the input field automatically
    groupNameInput.focus();

    // Handle form submission
    submitButton.onclick = function () {
      const groupName = groupNameInput.value.trim();
      if (groupName) {
        createNewGroup(groupName, stream, contextMenu);
        formContainer.remove(); // Remove form after submission
      } else {
        alert("Please enter a valid group name.");
      }
    };

    // Handle Enter key press
    groupNameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        const groupName = groupNameInput.value.trim();
        if (groupName) {
          createNewGroup(groupName, stream, contextMenu);
          formContainer.remove(); // Remove form after submission
        } else {
          alert("Please enter a valid group name.");
        }
      }
    });
  }
}

function deleteGroup(index, contextMenu) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    var groups = data.favoriteGroups || [];
    if (index >= 0 && index < groups.length) {
      groups.splice(index, 1); // Remove the group from the array
      chrome.storage.local.set({ favoriteGroups: groups }, function () {
        console.log("Group deleted");

        // Remove the group from the context menu
        const menuItem = contextMenu.childNodes[index + 1]; // Adjusting index to account for header
        if (menuItem) {
          contextMenu.removeChild(menuItem);
        }

        updateLiveStreams(); // Refresh streams if needed
      });
    } else {
      console.log("Invalid index for deletion.");
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.querySelectorAll('.settings-section');

  menuItems.forEach(item => {
    item.addEventListener('click', function () {
      // Remove active class from all items
      menuItems.forEach(i => i.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      // Add active class to clicked item
      this.classList.add('active');

      // Show corresponding section
      const sectionId = this.getAttribute('data-section') + '-section';
      document.getElementById(sectionId).classList.add('active');
    });
  });
});
