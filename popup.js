document.addEventListener("DOMContentLoaded", function () {
  applyDarkMode();

  // Update live streams immediately for all users
  updateLiveStreams();

  // Delay checking login status to ensure smooth rendering
  setTimeout(checkLoginAndDisplayButton, 100);

  // Set an interval to update live streams and check login status every 30 seconds
  setInterval(function () {
    updateLiveStreams();
    setTimeout(checkLoginAndDisplayButton, 100);
  }, 30000);

  setTimeout(initRateLimitCheck, 1000);

  // Accessing buttonContainer & spinner element
  const buttonContainer = document.getElementById("buttonContainer");

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
      container.classList.toggle('with-avatar', showAvatar);
      const currentScrollPosition = container.scrollTop;
      container.innerHTML = "";

      const scrollContainer = document.createElement("div");
      scrollContainer.id = "scrollContainer";

      let isAnyFavoriteGroupLive = false; // This will track if any favorite group is live

      function appendStreamLink(stream, container) {
        const channelItem = document.createElement("div");
        channelItem.className = "stream-item";

        const isRerun = stream.title.toLowerCase().includes("rerun");

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
            avatarImg = document.createElement("img");
            avatarImg.src = stream.avatar;
            avatarImg.className = "stream-avatar";
            avatarImg.alt = `${stream.channelName}'s avatar`;
            avatarImg.style.width = "30px";
            avatarImg.style.height = "30px";
            avatarImg.style.borderRadius = "15px";
            avatarImg.style.marginRight = "5px";
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
            // Color will be controlled via CSS
            categorySpan.style.display = "block";
            categorySpan.style.marginTop = "2px";

            // Add a specific class that you can target in CSS
            categorySpan.classList.add("newline-category");
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
          viewersWrapper.style.top = "11px";
          viewersWrapper.style.right = "5px";
        }

        const showStreamTime = result.showStreamTime === "on";

        if (showStreamTime) {
          const timeSpan = document.createElement("span");
          timeSpan.className = "stream-time";
          timeSpan.style.fontSize = "12px";
          timeSpan.style.color = "#9CA3AF";
          timeSpan.textContent = formatStreamTime(stream.started_at);

          // Special handling for newline mode with thumbnail
          if (streamTitleDisplay === "newline" && stream.thumbnail) {
            timeSpan.classList.add("stream-time-overlay");
            const thumbnailContainer = document.createElement("div");
            thumbnailContainer.style.position = "relative";
            thumbnailContainer.appendChild(avatarImg);
            thumbnailContainer.appendChild(timeSpan);
            channelLink.appendChild(thumbnailContainer);
          } else {
            // Add timeSpan to viewersWrapper before viewers count
            viewersWrapper.appendChild(timeSpan);
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

        const viewersSpan = document.createElement("span");
        viewersSpan.className = isRerun ? "viewers rerun" : "viewers";
        viewersSpan.textContent = formatViewerCount(stream.viewers);
        viewersWrapper.appendChild(viewersSpan);

        // Include signal icon if avatar is shown
        if (showAvatar && stream.avatar) {
          const iconImg = document.createElement("img");
          iconImg.src = isRerun ? "css/rerun.svg" : "css/signal.svg";
          iconImg.className = "signal-icon";
          iconImg.alt = "Signal";
          iconImg.style.height = "13px";
          iconImg.style.width = "13px";
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

          // Add click handler
          groupNameHeader.addEventListener('click', function () {
            this.classList.toggle('collapsed');
            let nextElement = this.nextElementSibling;
            while (nextElement && !nextElement.classList.contains('group-header')) {
              nextElement.style.display = this.classList.contains('collapsed') ? 'none' : 'block';
              nextElement = nextElement.nextElementSibling;
            }
          });

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

          // Add click handler
          gameHeader.addEventListener('click', function () {
            this.classList.toggle('collapsed');
            let nextElement = this.nextElementSibling;
            while (nextElement && !nextElement.classList.contains('group-header')) {
              nextElement.style.display = this.classList.contains('collapsed') ? 'none' : 'block';
              nextElement = nextElement.nextElementSibling;
            }
          });

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
        // Original behavior remains the same // For "MORE LIVE TWITCH CHANNELS"
        if (ungroupedStreams.length > 0 && isAnyFavoriteGroupLive) {
          const otherChannelsHeader = document.createElement("h3");
          otherChannelsHeader.textContent = "MORE LIVE TWITCH CHANNELS";
          otherChannelsHeader.classList.add("group-header");

          // Add click handler
          otherChannelsHeader.addEventListener('click', function () {
            this.classList.toggle('collapsed');
            let nextElement = this.nextElementSibling;
            while (nextElement && !nextElement.classList.contains('group-header')) {
              nextElement.style.display = this.classList.contains('collapsed') ? 'none' : 'block';
              nextElement = nextElement.nextElementSibling;
            }
          });

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

function incrementChannelAccess(broadcasterLogin) {
  chrome.storage.local.get(["channelAccess"], function (result) {
    let channelAccess = result.channelAccess || {};
    channelAccess[broadcasterLogin] =
      (channelAccess[broadcasterLogin] || 0) + 1;
    chrome.storage.local.set({ channelAccess: channelAccess });
  });
}

function applyDarkMode() {
  chrome.storage.local.get("darkMode", function (data) {
    // Reset theme classes first
    document.body.classList.remove("dark-mode", "light-mode", "very-dark-mode");

    // Apply appropriate theme based on stored preference
    const themePreference = data.darkMode || "dark";

    if (themePreference === "dark") {
      document.body.classList.add("dark-mode");
    } else if (themePreference === "verydark") {
      document.body.classList.add("dark-mode"); // For compatibility
      document.body.classList.add("very-dark-mode"); // Additional class for very dark styling
    } else {
      document.body.classList.add("light-mode");
    }
  });
}
/* Custom scrollbar for Firefox */
if (navigator.userAgent.includes("Firefox")) {
  document.body.style.scrollbarWidth = "thin";
  document.body.style.scrollbarColor = "#6441a5 #efeff1";
}
