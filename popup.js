document.addEventListener("DOMContentLoaded", function () {
  applyDarkMode();
  updateLiveStreams();
  updateSettingsIcon();
  setInterval(updateLiveStreams, 30000);

  const buttonContainer = document.getElementById("buttonContainer");

  // Create the spinner element for loading
  const spinner = document.createElement("img");
  spinner.id = "spinner";
  spinner.src = "css/loading.webp";
  spinner.style.display = "none";

  chrome.storage.local.get(["twitchAccessToken"], function (result) {
    if (!result.twitchAccessToken) {
      const loginButton = document.createElement("button");
      loginButton.id = "loginButton";
      loginButton.textContent = "Login with Twitch";
      loginButton.addEventListener("click", function () {
        spinner.style.display = "block"; // Show the spinner
        loginButton.style.display = "none"; // Hide the login button
        const description = document.getElementById("description");
        description.style.display = "none"; // Hide the description text
        notLoggedInIcon.style.display = "none";
        chrome.runtime.sendMessage({ action: "startOAuth" });
      });
      buttonContainer.appendChild(loginButton);

      const description = document.createElement("div");
      description.textContent =
        "Log in with Twitch to see live channels you follow!";
      description.id = "description";
      buttonContainer.appendChild(description);

      // Create and append the not logged in icon
      const notLoggedInIcon = document.createElement("img");
      notLoggedInIcon.src = "css/notlogged.webp"; // Change the source to the .webp file
      notLoggedInIcon.alt = "Not Logged In";

      notLoggedInIcon.style.height = "auto"; // Maintain aspect ratio
      notLoggedInIcon.style.marginTop = "10px";
      notLoggedInIcon.style.display = "block"; // To enable margin auto to work
      notLoggedInIcon.style.marginLeft = "auto";
      notLoggedInIcon.style.marginRight = "auto";

      buttonContainer.appendChild(notLoggedInIcon);

      buttonContainer.appendChild(spinner); // Place the spinner next to the description
    }
  });

  // Event listener for the settings icon
  document
    .getElementById("settingsIcon")
    .addEventListener("click", function () {
      var screenWidth = 585; // Define the width you want for the window
      var screenHeight = Math.min(window.screen.availHeight, 600);

      window.open(
        "settings.html",
        "ExtensionSettings",
        "width=" + screenWidth + ",height=" + screenHeight
      );
    });

  // Listener for OAuth completion
  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    if (message.action === "oauthComplete") {
      applyDarkMode();
      spinner.style.display = "none"; // Hide the spinner

      // Start an interval to refresh every 500ms
      let refreshInterval = setInterval(updateLiveStreams, 500);

      // Stop refreshing after 5 seconds
      setTimeout(() => {
        clearInterval(refreshInterval);
      }, 5000);
    }
  });
});

function updateLiveStreams() {
  chrome.storage.local.get(
      [
          "liveStreams",
          "favoriteGroups",
          "showAvatar",
          "channelAccess",
          "hideAccessedCount",
      ],
      function (result) {
          const liveStreams = result.liveStreams || [];
          const favoriteGroups = result.favoriteGroups || [];
          const showAvatar = (result.showAvatar !== undefined) ? result.showAvatar : true;
          const channelAccess = result.channelAccess || {};
          const hideAccessedCount = (result.hideAccessedCount !== undefined) ? result.hideAccessedCount : false;
 // Default to true

          // Sort channels based on access count
          liveStreams.sort(
              (a, b) =>
                  (channelAccess[b.channelName] || 0) -
                  (channelAccess[a.channelName] || 0)
          );

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
            channelLink.href = `https://www.twitch.tv/${stream.channelName}`;
            channelLink.className = "stream-info";
            channelLink.target = "_blank";
        
            channelLink.addEventListener("click", function (event) {
              event.preventDefault();  // Prevent the default link behavior immediately
              incrementChannelAccess(stream.channelName);
      
              // Use setTimeout to delay the redirection
              setTimeout(() => {
                  window.open(channelLink.href, '_blank');
              }, 10); // Delay in milliseconds, 100 is just an example
          });
        
            const wrapperDiv = document.createElement("div");
            wrapperDiv.className = "channel-category-wrapper";
        
            // Sub-wrapper for channel name, category, and viewers
            const subWrapper = document.createElement("div");
            subWrapper.className = showAvatar ? "sub-wrapper-with-avatar" : "";
        
            if (showAvatar && stream.avatar) {
                const avatarImg = document.createElement("img");
                avatarImg.src = stream.avatar;
                avatarImg.className = "stream-avatar";
                avatarImg.alt = `${stream.channelName}'s avatar`;
                avatarImg.style.width = "30px";
                avatarImg.style.height = "30px";
                avatarImg.style.borderRadius = "15px";
                avatarImg.style.marginRight = "5px";
                channelLink.appendChild(avatarImg);
        
                channelLink.classList.add("with-avatar");
                wrapperDiv.classList.add("channel-category-wrapper-with-avatar");
            }
            const channelNameSpan = document.createElement("span");
    channelNameSpan.className = "channel-name";
    channelNameSpan.textContent = stream.channelName;
    channelNameSpan.style.textAlign = "left"; // Align text to the left

    const categoryDiv = document.createElement("div");
    categoryDiv.style.textAlign = "left"; // Align text to the left within this div

    if (showAvatar && stream.avatar) {
        categoryDiv.appendChild(channelNameSpan);

        const categorySpan = document.createElement("span");
        categorySpan.className = "stream-category-with-avatar";
        categorySpan.textContent = stream.category;
        categorySpan.style.textAlign = "left"; // Align text to the left
        categoryDiv.appendChild(categorySpan);
        subWrapper.appendChild(categoryDiv);
    } else {
        wrapperDiv.appendChild(channelNameSpan);
    }
        
    const accessCountDiv = document.createElement("div");
    accessCountDiv.className = "access-count-div";
    accessCountDiv.style.position = "absolute";
    accessCountDiv.style.bottom = "0"; // Align at the bottom
    accessCountDiv.style.left = "0"; // Align to the left side
    accessCountDiv.style.width = "100%";
    accessCountDiv.style.boxSizing = "border-box"; // Include padding and border in the element's width
    accessCountDiv.style.padding = "0 5px"; // Adjust padding as needed
    accessCountDiv.style.margin = "0"; // Ensure no extra margin is added

    if (hideAccessedCount) {
        const accessCount = channelAccess[stream.channelName] || 0;
        const accessCountSpan = document.createElement("span");
        accessCountSpan.className = "access-count";
        accessCountSpan.textContent = `Accessed: ${accessCount} times`;
        accessCountSpan.style.display = "none";
        accessCountDiv.appendChild(accessCountSpan);
        wrapperDiv.appendChild(accessCountDiv);

        channelItem.onmouseover = function () {
            accessCountSpan.style.display = "block";
        };
        channelItem.onmouseout = function () {
            accessCountSpan.style.display = "none";
        };
            }
        
            if (!showAvatar || !stream.avatar) {
              const categorySpan = document.createElement("span");
              categorySpan.className = "stream-category";
              categorySpan.textContent = stream.category;
              categorySpan.style.textAlign = "left"; // Align text to the left
              wrapperDiv.appendChild(categorySpan);
          }
        
            const viewersWrapper = document.createElement("div");
            viewersWrapper.className = showAvatar ? "viewers-wrapper-with-avatar" : "viewers-wrapper";
        
            const viewersSpan = document.createElement("span");
            viewersSpan.className = "viewers";
            viewersSpan.textContent = stream.viewers;
            viewersWrapper.appendChild(viewersSpan);

                        // Include SVG icon only if showAvatar and stream.avatar are true
                        if (showAvatar && stream.avatar) {
                          const iconImg = document.createElement("img");
                          iconImg.src = "css/signal.svg"; // Set the source to your SVG file
                          iconImg.className = "signal-icon";
                          iconImg.alt = "Signal";
                          iconImg.style.height = "13px";
                          iconImg.style.width = "13px";
                          iconImg.style.marginLeft = "-5px";
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
        
            container.appendChild(channelItem);
        }
        
        

      favoriteGroups.forEach((group) => {
        const liveGroupStreams = liveStreams.filter((stream) =>
          group.streamers
            .map((s) => s.toLowerCase())
            .includes(stream.channelName.toLowerCase())
        );

        if (liveGroupStreams.length > 0) {
          isAnyFavoriteGroupLive = true; // Set to true if any favorite group is live

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

      // Display "MORE LIVE TWITCH CHANNELS" only if any favorite group is live
      if (ungroupedStreams.length > 0 && isAnyFavoriteGroupLive) {
        const otherChannelsHeader = document.createElement("h3");
        otherChannelsHeader.textContent = "MORE LIVE TWITCH CHANNELS";
        otherChannelsHeader.classList.add("group-header");
        scrollContainer.appendChild(otherChannelsHeader);
      }

      ungroupedStreams.forEach((stream) => {
        appendStreamLink(stream, scrollContainer);
      });

      container.appendChild(scrollContainer);
      container.scrollTop = currentScrollPosition;
    }
  );
}

function incrementChannelAccess(channelName) {
  chrome.storage.local.get(["channelAccess"], function (result) {
    let channelAccess = result.channelAccess || {};
    channelAccess[channelName] = (channelAccess[channelName] || 0) + 1;

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
    // If darkMode is undefined or true, enable dark mode. Otherwise, use light mode.
    var isDarkMode = (data.darkMode !== undefined) ? data.darkMode : true;
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  });
}
