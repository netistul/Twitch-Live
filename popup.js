document.addEventListener("DOMContentLoaded", function () {
  updateLiveStreams();
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
        chrome.runtime.sendMessage({ action: "startOAuth" });
      });
      buttonContainer.appendChild(loginButton);

      const description = document.createElement("div");
      description.textContent = "Log in with Twitch to see live channels you follow!";
      description.id = "description";
      buttonContainer.appendChild(description);
      buttonContainer.appendChild(spinner); // Place the spinner next to the description
    }
  });
  
    // Event listener for the settings icon
    document.getElementById("settingsIcon").addEventListener("click", function() {
      var screenWidth = 654; // Define the width you want for the window
var screenHeight = window.screen.availHeight; // Get the available screen height

window.open("settings.html", "ExtensionSettings", "width=" + screenWidth + ",height=" + screenHeight);
    });
  
    // Listener for OAuth completion
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "oauthComplete") {
      spinner.style.display = "none"; // Hide the spinner
      setTimeout(() => window.location.reload(), 1300); // 1 second delay
    }
  });
});

function updateLiveStreams() {
  chrome.storage.local.get(["liveStreams", "favoriteGroups", "showAvatar"], function (result) {
    const liveStreams = result.liveStreams || [];
    const favoriteGroups = result.favoriteGroups || [];
    const showAvatar = result.showAvatar; // Retrieve the "Show Avatar" preference

    // Map to keep track of streamers in each group
    const groupStreamMap = favoriteGroups.reduce((acc, group) => {
      acc[group.name.toUpperCase()] = group.streamers.map(streamer => streamer.toLowerCase());
      return acc;
    }, {});

    const container = document.getElementById("buttonContainer");
    container.innerHTML = ""; // Clear existing content

    function appendStreamLink(stream) {
      const channelLink = document.createElement("a");
      channelLink.href = `https://www.twitch.tv/${stream.channelName}`;
      channelLink.className = "stream-info";
      channelLink.target = "_blank";

      // Check if the setting is enabled before adding the avatar
      if (showAvatar && stream.avatar) {
        const avatarImg = document.createElement("img");
        avatarImg.src = stream.avatar;
        avatarImg.className = "stream-avatar";
        avatarImg.alt = `${stream.channelName}'s avatar`;
        avatarImg.style.width = '30px';
        avatarImg.style.height = '30px';
        avatarImg.style.borderRadius = '15px';
        avatarImg.style.marginRight = '5px';
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

      channelLink.appendChild(wrapperDiv);

      const viewersSpan = document.createElement("span");
      viewersSpan.className = "viewers";
      viewersSpan.textContent = stream.viewers;
      channelLink.appendChild(viewersSpan);

      container.appendChild(channelLink);
    }

    // Display group headers and their live streams
    favoriteGroups.forEach(group => {
      const liveGroupStreams = liveStreams.filter(stream => 
        group.streamers.map(s => s.toLowerCase()).includes(stream.channelName.toLowerCase())
      );

      if (liveGroupStreams.length > 0) {
        const groupNameHeader = document.createElement("h3");
        groupNameHeader.textContent = group.name.toUpperCase(); // Convert group name to uppercase
        groupNameHeader.classList.add('group-header'); // Apply the custom style
        container.appendChild(groupNameHeader);

        liveGroupStreams.forEach(stream => {
          appendStreamLink(stream);
        });
      }
    });

    // Handle ungrouped channels
    let ungroupedChannelsExist = false;
    liveStreams.forEach(stream => {
      let inGroup = false;
      favoriteGroups.forEach(group => {
        if (group.streamers.includes(stream.channelName.toLowerCase())) {
          inGroup = true;
        }
      });

      if (!inGroup) {
        if (!ungroupedChannelsExist) {
          const otherChannelsHeader = document.createElement("h3"); // Use h3 to match grouped headers
          otherChannelsHeader.textContent = "MORE TWITCH CHANNELS";
          otherChannelsHeader.classList.add('group-header'); // Apply the same class as grouped headers
          container.appendChild(otherChannelsHeader);
          ungroupedChannelsExist = true;
        }
        appendStreamLink(stream);
      }
    });
  });
}





