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
      var screenWidth = 674; // Define the width you want for the window
      var screenHeight = Math.min(window.screen.availHeight, 600);

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
    const showAvatar = result.showAvatar === true;

    const container = document.getElementById("buttonContainer");
    container.innerHTML = ""; // Clear existing content

    const scrollContainer = document.createElement("div");
    scrollContainer.id = "scrollContainer"; // Assign an ID to the scrollable container

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

      const viewersSpan = document.createElement("span");
      viewersSpan.className = "viewers";
      viewersSpan.textContent = stream.viewers;
      wrapperDiv.appendChild(viewersSpan);

      channelLink.appendChild(wrapperDiv);

      container.appendChild(channelLink); // Append to the provided container
    }

    // Display group headers and their live streams
    favoriteGroups.forEach(group => {
      const liveGroupStreams = liveStreams.filter(stream => 
        group.streamers.map(s => s.toLowerCase()).includes(stream.channelName.toLowerCase())
      );

      if (liveGroupStreams.length > 0) {
        const groupNameHeader = document.createElement("h3");
        groupNameHeader.textContent = group.name.toUpperCase(); 
        groupNameHeader.classList.add('group-header'); 
        scrollContainer.appendChild(groupNameHeader); // Append group header to the scrollable container

        liveGroupStreams.forEach(stream => {
          appendStreamLink(stream, scrollContainer); // Append streams to the scrollable container
        });
      }
    });

    // Determine if there are any ungrouped channels
    const ungroupedStreams = liveStreams.filter(stream => {
      return !favoriteGroups.some(group => 
        group.streamers.map(s => s.toLowerCase()).includes(stream.channelName.toLowerCase())
      );
    });

    if (ungroupedStreams.length > 0) {
      const otherChannelsHeader = document.createElement("h3");
      otherChannelsHeader.textContent = "MORE TWITCH CHANNELS";
      otherChannelsHeader.classList.add('group-header');
      scrollContainer.appendChild(otherChannelsHeader); // Append the header to the scrollable container

      ungroupedStreams.forEach(stream => {
        appendStreamLink(stream, scrollContainer); // Append streams to the scrollable container
      });
    }

    container.appendChild(scrollContainer); // Append the scrollable container to the main container

    // Adjust the height of the scrollable container if necessary
    const maxHeight = 600; // Maximum height for the scrollable area
    if (scrollContainer.scrollHeight > maxHeight) {
      scrollContainer.style.height = `${maxHeight}px`;
    }
  });
}




