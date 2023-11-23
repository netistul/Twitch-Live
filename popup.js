document.addEventListener("DOMContentLoaded", function () {
  applyDarkMode();
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
      var screenWidth = 565; // Define the width you want for the window
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
  chrome.storage.local.get(["liveStreams", "favoriteGroups", "showAvatar", "channelAccess", "hideAccessedCount"], function(result) {
    const liveStreams = result.liveStreams || [];
    const favoriteGroups = result.favoriteGroups || [];
    const showAvatar = result.showAvatar === true;
    const channelAccess = result.channelAccess || {};
    const hideAccessedCount = result.hideAccessedCount || false;

    // Sort channels based on access count
    liveStreams.sort((a, b) => (channelAccess[b.channelName] || 0) - (channelAccess[a.channelName] || 0));

    const container = document.getElementById("buttonContainer");
    const currentScrollPosition = container.scrollTop;
    container.innerHTML = "";

    const scrollContainer = document.createElement("div");
    scrollContainer.id = "scrollContainer";

    let anyFavoriteGroupLive = false; // Flag to check if any favorite group has live streams

    favoriteGroups.forEach(group => {
      const liveGroupStreams = liveStreams.filter(stream =>
        group.streamers.map(s => s.toLowerCase()).includes(stream.channelName.toLowerCase())
      );

      if (liveGroupStreams.length > 0) {
        anyFavoriteGroupLive = true;

        const groupNameHeader = document.createElement("h3");
        groupNameHeader.textContent = group.name.toUpperCase();
        groupNameHeader.classList.add("group-header");
        scrollContainer.appendChild(groupNameHeader);

        liveGroupStreams.forEach(stream => {
          appendStreamLink(stream, scrollContainer, hideAccessedCount, showAvatar, channelAccess);
        });
      }
    });

    const ungroupedStreams = liveStreams.filter(stream =>
      !favoriteGroups.some(group =>
        group.streamers.map(s => s.toLowerCase()).includes(stream.channelName.toLowerCase())
      )
    );

    if (ungroupedStreams.length > 0 && anyFavoriteGroupLive) {
      const otherChannelsHeader = document.createElement("h3");
      otherChannelsHeader.textContent = "MORE LIVE TWITCH CHANNELS";
      otherChannelsHeader.classList.add("group-header");
      scrollContainer.appendChild(otherChannelsHeader);
    }

    ungroupedStreams.forEach(stream => {
      appendStreamLink(stream, scrollContainer, hideAccessedCount, showAvatar, channelAccess);
    });

    container.appendChild(scrollContainer);
    container.scrollTop = currentScrollPosition;
  });
}

function appendStreamLink(stream, container, hideAccessedCount, showAvatar, channelAccess) {
  const channelItem = document.createElement("div");
  channelItem.className = "stream-item";

  const channelLink = document.createElement("a");
  channelLink.href = `https://www.twitch.tv/${stream.channelName}`;
  channelLink.className = "stream-info";
  channelLink.target = "_blank";

  channelLink.addEventListener("click", function() {
    incrementChannelAccess(stream.channelName);
  });

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

  if (!hideAccessedCount) {
    // Display the access count for the channel
    const accessCount = channelAccess[stream.channelName] || 0;
    const accessCountSpan = document.createElement("span");
    accessCountSpan.className = "access-count";
    accessCountSpan.textContent = `Accessed: ${accessCount} times`;
    accessCountSpan.style.display = "none";
    wrapperDiv.appendChild(accessCountSpan);

    channelItem.onmouseover = function() {
      accessCountSpan.style.display = "block";
    };
    channelItem.onmouseout = function() {
      accessCountSpan.style.display = "none";
    };
  }

  const categorySpan = document.createElement("span");
  categorySpan.className = "stream-category";
  categorySpan.textContent = stream.category;
  wrapperDiv.appendChild(categorySpan);

  const viewersSpan = document.createElement("span");
  viewersSpan.className = "viewers";
  viewersSpan.textContent = stream.viewers;
  wrapperDiv.appendChild(viewersSpan);

  channelLink.appendChild(wrapperDiv);
  channelItem.appendChild(channelLink);

  container.appendChild(channelItem);
}

function incrementChannelAccess(channelName) {
  chrome.storage.local.get(["channelAccess"], function(result) {
      let channelAccess = result.channelAccess || {};
      channelAccess[channelName] = (channelAccess[channelName] || 0) + 1;

      chrome.storage.local.set({channelAccess: channelAccess});
  });
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

function applyDarkMode() {
  chrome.storage.local.get("darkMode", function(data) {
    if(data.darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  });
}