document.addEventListener("DOMContentLoaded", function () {
  updateLiveStreams();

  // Update the live streams every minute
  setInterval(updateLiveStreams, 60000);

  chrome.storage.local.get(["twitchAccessToken"], function (result) {
    const buttonContainer = document.getElementById("buttonContainer");

    if (!result.twitchAccessToken) {
      // User is not logged in, create and show the login button and description
      const loginButton = document.createElement("button");
      loginButton.id = "loginButton";
      loginButton.textContent = "Login with Twitch";
      loginButton.addEventListener("click", function () {
        chrome.runtime.sendMessage({ action: "startOAuth" });
      });
      buttonContainer.appendChild(loginButton);

      const description = document.createElement("div");
      description.textContent =
        "Log in with Twitch to see live channels you follow!";
      description.id = "description";
      buttonContainer.appendChild(description);
    }
    // No need to fetch user profile here
  });

  // Listen for a message from background.js
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "oauthComplete") {
      // Adding a short delay to ensure all data is fetched and stored
      setTimeout(() => window.location.reload(), 1000); // 1 second delay
    }
  });
});

function updateLiveStreams() {
  chrome.storage.local.get(["liveStreams"], function (result) {
    const liveStreams = result.liveStreams;
    if (liveStreams && liveStreams.length > 0) {
      const container = document.getElementById("buttonContainer");
      container.innerHTML = ""; // Clear existing content

      liveStreams.forEach((stream) => {
        const streamDiv = document.createElement("div");
        streamDiv.className = "stream-info"; // Apply the new class

        const channelLink = document.createElement("a");
        channelLink.href = `https://www.twitch.tv/${stream.channelName}`;
        channelLink.textContent = stream.channelName;
        channelLink.className = "channel-name";
        channelLink.target = "_blank";

        const viewersSpan = document.createElement("span");
        viewersSpan.className = "viewers"; // Apply a class for viewers
        viewersSpan.textContent = stream.viewers;

        streamDiv.appendChild(channelLink);
        streamDiv.appendChild(viewersSpan);
        container.appendChild(streamDiv);
      });
    }
  });
}
