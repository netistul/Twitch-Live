document.addEventListener("DOMContentLoaded", function () {
  updateLiveStreams();
  setInterval(updateLiveStreams, 60000); // Update every minute

  const buttonContainer = document.getElementById("buttonContainer");

  // Create the spinner element for loading
  const spinner = document.createElement("img");
  spinner.id = "spinner";
  spinner.src = "css/loading.webp"; // Set the source to your loading image
  spinner.style.display = "none"; // Initially hidden
  buttonContainer.appendChild(spinner);

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
    }
  });

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "oauthComplete") {
      spinner.style.display = "none"; // Hide the spinner
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
        // Create the link that will cover the entire row
        const channelLink = document.createElement("a");
        channelLink.href = `https://www.twitch.tv/${stream.channelName}`;
        channelLink.className = "stream-info";
        channelLink.target = "_blank";

        // Create a wrapper div for channel name and category
        const wrapperDiv = document.createElement("div");
        wrapperDiv.className = "channel-category-wrapper";

        // Create and append the channel name span to the wrapper
        const channelNameSpan = document.createElement("span");
        channelNameSpan.className = "channel-name";
        channelNameSpan.textContent = stream.channelName;
        wrapperDiv.appendChild(channelNameSpan);

        // Create and append the category span to the wrapper
        const categorySpan = document.createElement("span");
        categorySpan.className = "stream-category";
        categorySpan.textContent = stream.category; // Ensure category data is present
        wrapperDiv.appendChild(categorySpan);

        // Append the wrapper div to the channel link
        channelLink.appendChild(wrapperDiv);

        // Create and append the viewers span to the channel link
        const viewersSpan = document.createElement("span");
        viewersSpan.className = "viewers";
        viewersSpan.textContent = stream.viewers;
        channelLink.appendChild(viewersSpan);

        // Append the channel link to the container
        container.appendChild(channelLink);
      });
    }
  });
  
}



