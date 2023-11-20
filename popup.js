document.addEventListener("DOMContentLoaded", function () {
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
  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    if (message.action === "oauthComplete") {
      window.location.reload();
    }
  });
});
