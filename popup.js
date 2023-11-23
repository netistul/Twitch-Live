document.addEventListener("DOMContentLoaded", function () {
  updateLiveStreams();
  updateSettingsIcon();
  setInterval(updateLiveStreams, 10000);

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
        chrome.runtime.sendMessage({ action: "startOAuth" });
      });
      buttonContainer.appendChild(loginButton);

      const description = document.createElement("div");
      description.textContent =
        "Log in with Twitch to see live channels you follow!";
      description.id = "description";
      buttonContainer.appendChild(description);
      buttonContainer.appendChild(spinner); // Place the spinner next to the description
    }
  });

  // Event listener for the settings icon
  document
    .getElementById("settingsIcon")
    .addEventListener("click", function () {
      var screenWidth = 545; // Define the width you want for the window
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
    ["liveStreams", "favoriteGroups", "showAvatar"],
    function (result) {
      const liveStreams = result.liveStreams || [];
      const favoriteGroups = result.favoriteGroups || [];
      const showAvatar = result.showAvatar === true;

      const container = document.getElementById("buttonContainer");

      // Remember the current scroll position
      const currentScrollPosition = container.scrollTop;

      container.innerHTML = "";

      const scrollContainer = document.createElement("div");
      scrollContainer.id = "scrollContainer";

      function appendStreamLink(stream, container) {
        const channelLink = document.createElement("a");
        channelLink.href = `https://www.twitch.tv/${stream.channelName}`;
        channelLink.className = "stream-info";
        channelLink.target = "_blank";

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
        }

        const wrapperDiv = document.createElement("div");
        wrapperDiv.className = "channel-category-wrapper";

        const channelNameSpan = document.createElement("span");
        channelNameSpan.className = "channel-name";
        channelNameSpan.textContent = stream.channelName;
        wrapperDiv.appendChild(channelNameSpan);

        const categorySpan = document.createElement("span");
        categorySpan.className = "stream-category";
        categorySpan.textContent = stream.category;
        wrapperDiv.appendChild(categorySpan);

        const viewersSpan = document.createElement("span");
        viewersSpan.className = "viewers";
        viewersSpan.textContent = stream.viewers;
        wrapperDiv.appendChild(viewersSpan);

        channelLink.appendChild(wrapperDiv);

        container.appendChild(channelLink); // Append to the provided container
      }

      let anyFavoriteGroupLive = false; // Flag to check if any favorite group has live streams

      // Display group headers and their live streams
      favoriteGroups.forEach((group) => {
        const liveGroupStreams = liveStreams.filter((stream) =>
          group.streamers
            .map((s) => s.toLowerCase())
            .includes(stream.channelName.toLowerCase())
        );

        if (liveGroupStreams.length > 0) {
          anyFavoriteGroupLive = true; // Set flag if there are live streams in any favorite group

          const groupNameHeader = document.createElement("h3");
          groupNameHeader.textContent = group.name.toUpperCase();
          groupNameHeader.classList.add("group-header");
          scrollContainer.appendChild(groupNameHeader);

          liveGroupStreams.forEach((stream) => {
            appendStreamLink(stream, scrollContainer);
          });
        }
      });

      // Determine if there are any ungrouped channels
      const ungroupedStreams = liveStreams.filter((stream) => {
        return !favoriteGroups.some((group) =>
          group.streamers
            .map((s) => s.toLowerCase())
            .includes(stream.channelName.toLowerCase())
        );
      });

      // Only display "MORE TWITCH CHANNELS" if there are live streams in favorite groups
      if (ungroupedStreams.length > 0 && anyFavoriteGroupLive) {
        const otherChannelsHeader = document.createElement("h3");
        otherChannelsHeader.textContent = "MORE LIVE TWITCH CHANNELS";
        otherChannelsHeader.classList.add("group-header");
        scrollContainer.appendChild(otherChannelsHeader);
      }

      ungroupedStreams.forEach((stream) => {
        appendStreamLink(stream, scrollContainer);
      });

      container.appendChild(scrollContainer);

      // Adjust the height of the scrollable container if necessary
      const maxHeight = 600;
      if (scrollContainer.scrollHeight > maxHeight) {
        scrollContainer.style.height = `${maxHeight}px`;
      }

      // Restore the previous scroll position
      container.scrollTop = currentScrollPosition;
    }
  );
}

// Function to update the settings icon based on user login status
function updateSettingsIcon() {
  const settingsIcon = document.getElementById('settingsIcon');

  chrome.storage.local.get(['userAvatar', 'twitchAccessToken'], function (result) {
    if (result.userAvatar && result.twitchAccessToken) {
      // User is logged in, update the settings icon to user's avatar
      settingsIcon.src = result.userAvatar;
    } else {
      // User is not logged in, use the default settings icon
      settingsIcon.src = 'css/settings.png';
    }
  });
}

// In popup.js to update avatar .png
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === 'profileUpdated') {
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
