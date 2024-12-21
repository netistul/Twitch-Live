var isLoggedIn = false;
var hasFollowers = false;

function displayGroups() {
  chrome.storage.local.get(
    ["favoriteGroups", "twitchAccessToken", "followedList"],
    function (data) {
      var groups = data.favoriteGroups || [];
      var groupListContainer = document.getElementById("groupListContainer");
      var favoriteListText = document.getElementById("favoriteListText");
      var isLoggedIn = data.twitchAccessToken != null;
      var hasFollowers = data.followedList && data.followedList.length > 0;

      groupListContainer.innerHTML = "";

      if (groups.length === 0) {
        groupListContainer.innerHTML = `
      <p style="font-size: 16px; text-align: center;">
      <img src="css/nogroup.gif" style="display: block; margin: 0 auto;">
      <strong>No Favorite Groups Created Yet</strong><br><br>
      This is a list that will help you filter your favorite live streams from the popup into new category groups. <br><br>
      You can create a group and add any Twitch channel to it, organizing your streams. <br><br><small>💡 You can do this directly from this page or from the popup by right-clicking on any stream channel to open the context menu. From the menu, you can select an existing group or create a new one to add the stream.</small>
    </p>`;
        favoriteListText.style.display = "none";
      } else {
        favoriteListText.style.display = "block";
        var groupList = document.createElement("ul");
        groupList.id = "groupList";

        groups.forEach(function (group, index) {
          var groupItem = document.createElement("li");
          groupItem.classList.add("group-item");

          var groupNameSpan = document.createElement("span");
          groupNameSpan.textContent = group.name;
          groupItem.appendChild(groupNameSpan);

          var streamersList = document.createElement("ul");
          streamersList.classList.add("streamers-list");
          streamersList.style.listStyleType = "none";
          streamersList.style.padding = "0";

          group.streamers.forEach(function (streamer, streamerIndex) {
            var streamerItem = document.createElement("li");
            streamerItem.style.display = "flex";
            streamerItem.style.justifyContent = "space-between";
            streamerItem.style.alignItems = "center";
            streamerItem.style.fontSize = "70%";

            var twitchIcon = document.createElement("img");
            twitchIcon.src = "css/twitch.png";
            twitchIcon.alt = "Twitch";
            twitchIcon.style.width = "20px";
            twitchIcon.style.marginRight = "3px";
            streamerItem.appendChild(twitchIcon);

            var streamerNameSpan = document.createElement("span");
            streamerNameSpan.textContent = streamer;
            streamerNameSpan.style.flexGrow = "1";
            streamerItem.appendChild(streamerNameSpan);

            var deleteStreamerBtn = document.createElement("button");
            deleteStreamerBtn.textContent = "x";
            deleteStreamerBtn.style.width = "30px";
            deleteStreamerBtn.onclick = function () {
              deleteStreamer(index, streamerIndex);
            };
            streamerItem.appendChild(deleteStreamerBtn);

            streamersList.appendChild(streamerItem);

            if (
              (streamerIndex % 5 === 4 && streamerIndex !== 0) ||
              streamerIndex === group.streamers.length - 1
            ) {
              groupItem.appendChild(streamersList);
              streamersList = document.createElement("ul");
              streamersList.classList.add("streamers-list");
              streamersList.style.listStyleType = "none";
              streamersList.style.padding = "0";
            }
          });

          var buttonContainer = document.createElement("div");
          buttonContainer.classList.add("button-container");

          var addStreamerBtn = document.createElement("button");
          addStreamerBtn.className = "add-streamer-btn";
          addStreamerBtn.textContent = "Add a Twitch Channel";

          if (isLoggedIn && hasFollowers) {
            addStreamerBtn.onclick = function () {
              showAddStreamerDropdown(index);
              chrome.runtime.sendMessage({ action: "oauthComplete" });
            };
          } else {
            addStreamerBtn.onclick = function () {
              alert(
                "Log in or follow more streamers to have Twitch channels here!"
              );
            };
          }
          buttonContainer.appendChild(addStreamerBtn);

          var deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-group-btn";
          deleteBtn.textContent = "Delete this list";
          deleteBtn.onclick = function () {
            deleteGroup(index);
            displayGroups();
          };
          buttonContainer.appendChild(deleteBtn);

          groupItem.appendChild(buttonContainer);
          groupList.appendChild(groupItem);
        });

        groupListContainer.appendChild(groupList);
      }
    }
  );
}

// delete a streamer from a group
function deleteStreamer(groupIndex, streamerIndex) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    var groups = data.favoriteGroups || [];
    if (
      groups[groupIndex] &&
      groups[groupIndex].streamers[streamerIndex] != null
    ) {
      groups[groupIndex].streamers.splice(streamerIndex, 1);

      chrome.storage.local.set({ favoriteGroups: groups }, function () {
        console.log("Streamer deleted");
        chrome.runtime.sendMessage({ action: "oauthComplete" });
        displayGroups();
      });
    }
  });
}

//  delete a group
function deleteGroup(index) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    var groups = data.favoriteGroups || [];
    groups.splice(index, 1);

    chrome.storage.local.set({ favoriteGroups: groups }, function () {
      console.log("Group deleted");
      displayGroups();
    });
  });
}

// get the followed list
function getFollowedList() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("followedList", function (data) {
      if (data.followedList) {
        resolve(data.followedList);
      } else {
        reject("No followed list found");
      }
    });
  });
}

// show the streamer dropdown
function showAddStreamerDropdown(groupIndex) {
  getFollowedList()
    .then((followedList) => {
      // Close any existing dropdown, overlay, and message
      var existingDropdown = document.querySelector(".dropdown-menu");
      var existingOverlay = document.getElementById("dropdownOverlay");
      var existingMessage = document.getElementById("addChannelMessage");
      if (existingDropdown) {
        existingDropdown.remove();
      }
      if (existingOverlay) {
        existingOverlay.remove();
      }
      if (existingMessage) {
        existingMessage.remove();
      }

      // Create overlay for the dropdown
      var overlay = document.createElement("div");
      overlay.id = "dropdownOverlay";
      overlay.style.position = "fixed";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      overlay.style.zIndex = "2";

      // Create dropdown menu container
      var dropdownMenu = document.createElement("div");
      dropdownMenu.className = "dropdown-menu";

      // Retrieve favorite groups and then build the dropdown
      chrome.storage.local.get("favoriteGroups", function (data) {
        var groups = data.favoriteGroups || [];
        var groupName = groups[groupIndex]
          ? groups[groupIndex].name
          : "Unknown";

        // Append the overlay and dropdown to the body first to calculate their position
        document.body.appendChild(overlay);
        document.body.appendChild(dropdownMenu);
        // Add event listener to the overlay to close the dropdown when clicking outside
        overlay.addEventListener("click", function (event) {
          if (!dropdownMenu.contains(event.target)) {
            closeDropdown();
          }
        });
        dropdownMenu.style.display = "block";

        // Set width, position, and height of dropdown
        dropdownMenu.style.width = "300px";
        dropdownMenu.style.position = "fixed";
        dropdownMenu.style.overflowY = "auto";
        dropdownMenu.style.maxHeight = "400px";

        var screenWidth = window.innerWidth;
        var dropdownWidth = dropdownMenu.offsetWidth;
        var leftPosition = (screenWidth - dropdownWidth) / 2;
        dropdownMenu.style.left = `${leftPosition}px`;
        dropdownMenu.style.top = "50px";
        dropdownMenu.style.zIndex = "3";

        // Create and append the message element outside the dropdown
        var message = document.createElement("div");
        message.id = "addChannelMessage";
        message.textContent = "Add a channel for list " + groupName;
        message.style.padding = "10px";
        message.style.fontSize = "140%";
        message.style.fontWeight = "bold";
        message.style.color = "#efeff1";
        message.style.backgroundColor = "rgba(98, 80, 123, 0.8)";
        message.style.borderRadius = "8px";
        message.style.textAlign = "center";
        message.style.position = "fixed";
        message.style.width = "300px";
        var leftAdjustment = 20;
        message.style.left = `${leftPosition + leftAdjustment}px`;
        message.style.top = "20px";
        message.style.zIndex = "4";
        document.body.appendChild(message);

        // Adjust the message position based on the actual position of the dropdown
        var dropdownRect = dropdownMenu.getBoundingClientRect();
        var gapBetweenMessageAndDropdown = 13;
        message.style.top =
          dropdownRect.top -
          message.offsetHeight +
          gapBetweenMessageAndDropdown +
          "px";

        // Create search input
        var searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.placeholder = "Search streamer...";
        searchInput.style.width = "91%";
        searchInput.onkeyup = function () {
          var searchValue = this.value.toLowerCase();
          filterDropdown(dropdownMenu, searchValue);
        };
        dropdownMenu.appendChild(searchInput);

        // Create dropdown items
        followedList.forEach(function (channel) {
          var dropdownItem = document.createElement("a");
          dropdownItem.className = "dropdown-item";
          dropdownItem.style.display = "flex";
          dropdownItem.style.alignItems = "center";
          dropdownItem.style.justifyContent = "space-between";

          // Create an image element for the Twitch logo
          var twitchLogo = document.createElement("img");
          twitchLogo.src = "css/twitch.png";
          twitchLogo.alt = "Twitch Logo";
          twitchLogo.style.width = "13px";

          // Append the Twitch logo to the dropdown item
          dropdownItem.appendChild(twitchLogo);

          // Create a span element for the channel name with increased font size
          var channelNameSpan = document.createElement("span");
          channelNameSpan.className = "dropdown-channel-name";
          channelNameSpan.textContent = " " + channel.broadcaster_name;

          // Append the channel name span to the dropdown item
          dropdownItem.appendChild(channelNameSpan);

          // Create a Font Awesome plus icon and append it to the dropdown item
          var plusIcon = document.createElement("i");
          plusIcon.className = "fas fa-plus";
          plusIcon.style.float = "right";
          plusIcon.style.marginRight = "10px";
          plusIcon.style.opacity = "0";
          dropdownItem.appendChild(plusIcon);

          dropdownItem.onmouseenter = function () {
            plusIcon.style.opacity = "1";
          };
          dropdownItem.onmouseleave = function () {
            plusIcon.style.opacity = "0";
          };

          dropdownItem.onclick = function () {
            // Add Streamer to the group
            chrome.storage.local.get("favoriteGroups", function (data) {
              var groups = data.favoriteGroups || [];
              if (groups[groupIndex]) {
                groups[groupIndex].streamers.push(channel.broadcaster_name);

                chrome.storage.local.set(
                  { favoriteGroups: groups },
                  function () {
                    console.log(
                      "Streamer added:",
                      channel.broadcaster_name,
                      "to group",
                      groups[groupIndex].name
                    );
                    displayGroups(); // Refresh the displayed groups
                    showTemporaryInfo("Channel added successfully!");
                    chrome.runtime.sendMessage({ action: "oauthComplete" });
                  }
                );
              }
            });
            // Close the dropdown after selecting a channel
            closeDropdown();
          };
          dropdownMenu.appendChild(dropdownItem);
        });

        // Function to close dropdown and overlay, also remove the message
        function closeDropdown() {
          dropdownMenu.style.display = "none";
          overlay.style.display = "none";
          var messageToRemove = document.getElementById("addChannelMessage");
          if (messageToRemove) {
            messageToRemove.remove();
          }
          document.removeEventListener("click", closeDropdownEvent);
        }

        // Event to close dropdown when clicking outside
        function closeDropdownEvent(event) {
          if (!dropdownMenu.contains(event.target)) {
            closeDropdown();
          }
        }

        // Close dropdown and overlay when clicking outside
        setTimeout(() => {
          document.addEventListener("click", closeDropdownEvent);
        }, 0);
      });
    })
    .catch((error) => {
      console.error(error);
    });
}

// Global function to filter dropdown
function filterDropdown(dropdownMenu, searchValue) {
  var dropdownItems = dropdownMenu.getElementsByTagName("a");
  var noResultsFound = true;

  for (var i = 0; i < dropdownItems.length; i++) {
    var item = dropdownItems[i];
    var textValue = item.textContent || item.innerText;

    if (textValue.toLowerCase().indexOf(searchValue) > -1) {
      item.style.display = "";
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.justifyContent = "space-between";
      noResultsFound = false;
    } else {
      item.style.display = "none";
    }
  }

  // Check if the no results message already exists
  var noResultsMessage = dropdownMenu.querySelector(".no-results-message");
  if (noResultsFound) {
    if (!noResultsMessage) {
      // Create and display a no results message
      noResultsMessage = document.createElement("div");
      noResultsMessage.className = "no-results-message";
      noResultsMessage.textContent = `"${searchValue}" is not in your Twitch follow list!`;

      noResultsMessage.style.marginTop = "30px";
      noResultsMessage.style.marginLeft = "20px";
      noResultsMessage.style.fontSize = "1.1em";
      dropdownMenu.appendChild(noResultsMessage);
    } else {
      // Update the existing no results message
      noResultsMessage.textContent = `"${searchValue}" is not in your Twitch follow list!`;
      noResultsMessage.style.display = "";
      noResultsMessage.style.fontSize = "1.1em";
    }
  } else if (noResultsMessage) {
    // Hide the no results message if results are found
    noResultsMessage.style.display = "none";
  }
}

// DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", function () {
  var modal = document.getElementById("myModal");
  var btn = document.getElementById("addFavoriteGroupButton");
  var span = document.getElementsByClassName("close")[0];
  var saveButton = document.getElementById("saveGroup");

  btn.onclick = function () {
    modal.style.display = "block";
  };

  span.onclick = function () {
    modal.style.display = "none";
  };

  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };

  saveButton.addEventListener("click", function () {
    var groupName = document.getElementById("groupName").value;
    if (groupName) {
      chrome.storage.local.get("favoriteGroups", function (data) {
        var groups = data.favoriteGroups || [];
        var newGroup = { name: groupName, streamers: [] };
        groups.push(newGroup);

        chrome.storage.local.set({ favoriteGroups: groups }, function () {
          console.log("Group saved:", groupName);
          modal.style.display = "none";
          displayGroups();
        });
      });
    } else {
      console.log("No group name entered");
    }
  });

  // Load and set the "Show Avatar" preference
  chrome.storage.local.get("showAvatar", function (data) {
    document.getElementById("showAvatarCheckbox").checked =
      data.showAvatar === true;
  });

  // Save the "Show Avatar" preference when changed
  document
    .getElementById("showAvatarCheckbox")
    .addEventListener("change", function () {
      chrome.storage.local.set({ showAvatar: this.checked }, function () {
        console.log("Show Avatar preference updated:", this.checked);
      });
    });

  // Load and set the "Show Avatar" preference
  chrome.storage.local.get("showAvatar", function (data) {
    var checkbox = document.getElementById("showAvatarCheckbox");
    checkbox.checked = data.showAvatar === true;
    updatePreview(); // Update preview on page load
  });

  // Save the "Show Avatar" preference when changed
  document
    .getElementById("showAvatarCheckbox")
    .addEventListener("change", function () {
      chrome.storage.local.set({ showAvatar: this.checked }, function () {
        chrome.runtime.sendMessage({ action: "oauthComplete" });
        updatePreview(); // Update preview on checkbox change
      });
    });

  displayUserInfo();
  displayGroups();
});

var previewStream = null;

function updatePreview() {
  chrome.storage.local.get("liveStreams", function (data) {
    var liveStreams = data.liveStreams || [];
    var previewContainer = document.getElementById("previewContainer");

    if (liveStreams.length > 0) {
      previewStream =
        liveStreams[Math.floor(Math.random() * liveStreams.length)];

      previewContainer.innerHTML = "";

      var showAvatar = document.getElementById("showAvatarCheckbox").checked;

      var previewDiv = document.createElement("div");
      previewDiv.className = "stream-preview";

      var channelNameSpan = document.createElement("span");
      channelNameSpan.textContent = previewStream.channelName;
      channelNameSpan.className = "channel-name";

      if (showAvatar && previewStream.avatar) {
        var avatarImg = document.createElement("img");
        avatarImg.src = previewStream.avatar;
        avatarImg.className = "stream-avatar";
        previewDiv.appendChild(avatarImg);

        // Apply additional class when avatar is shown
        channelNameSpan.classList.add("channel-name-with-avatar");
      }

      previewDiv.appendChild(channelNameSpan);

      // Create a span for the viewers count and the signal icon
      var viewersSpan = document.createElement("span");
      viewersSpan.textContent = `\u00A0- `;
      viewersSpan.className = "viewers-count";

      // Add text node for viewers count
      var viewersCountText = document.createTextNode(
        `${previewStream.viewers} `
      );
      viewersSpan.appendChild(viewersCountText);

      if (showAvatar) {
        // If show avatar is on, display the signal icon after viewers count
        var signalIconSpan = document.createElement("span");
        signalIconSpan.className = "signal-icon";
        var signalIconImg = document.createElement("img");
        signalIconImg.src = "css/signal.svg";
        signalIconImg.style.height = "13px";
        signalIconImg.style.width = "13px";
        signalIconImg.style.marginLeft = "5px";
        signalIconSpan.appendChild(signalIconImg);

        viewersSpan.appendChild(signalIconSpan);
      }

      previewDiv.appendChild(viewersSpan);

      previewContainer.appendChild(previewDiv);

      previewContainer.style.display = "flex";
    } else {
      previewContainer.style.display = "none";
    }
  });
}

function showTemporaryInfo(message) {
  var infoDiv = document.createElement("div");
  infoDiv.textContent = message;
  infoDiv.style.position = "fixed";
  infoDiv.style.bottom = "20px";
  infoDiv.style.left = "50%";
  infoDiv.style.transform = "translateX(-50%)";
  infoDiv.style.backgroundColor = "#4CAF50";
  infoDiv.style.color = "white";
  infoDiv.style.padding = "10px";
  infoDiv.style.borderRadius = "5px";
  infoDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
  infoDiv.style.zIndex = "1000";
  infoDiv.style.textAlign = "center";

  document.body.appendChild(infoDiv);

  // Remove the infoDiv after 3 seconds
  setTimeout(function () {
    infoDiv.remove();
  }, 3000);
}

function displayUserInfo() {
  chrome.storage.local.get(
    ["userDisplayName", "userAvatar", "twitchAccessToken", "loginTipShown"],
    function (result) {
      const userInfoDiv = document.getElementById("userInfo");

      if (!result.twitchAccessToken) {
        const loginButton = document.createElement("button");
        loginButton.id = "loginButton";
        loginButton.textContent = "Login with Twitch";
        loginButton.classList.add("login-button");

        loginButton.addEventListener("click", function () {
          // Optionally add a spinner or loading indication here
          chrome.runtime.sendMessage({ action: "startOAuth" });
        });

        userInfoDiv.appendChild(loginButton);
        // Create and append the informative text
        const infoText = document.createElement("p");
        infoText.innerHTML =
          "Log in with Twitch to view channels you follow. <br><br> Enjoy real-time updates directly in the extension's popup, making sure you never miss a moment of your favorite streams!";
        infoText.style.marginTop = "10px";
        infoText.style.fontSize = "14px";
        infoText.style.color = "#646464";
        userInfoDiv.appendChild(infoText);
      } else if (result.userDisplayName && result.userAvatar) {
        // User is logged in, display their information
        userInfoDiv.innerHTML = `
  <div id="userTable">
    <div class="user-row">
      <div class="user-cell">Logged as:</div>
      <div class="user-cell user-avatar-container">
        <img src="${result.userAvatar}" alt="User Avatar" class="user-avatar">
        <div class="logout-dropdown">
          <a href="#" id="logoutButton">
            <img src="css/logout.png" alt="Logout" class="logout-icon"> Logout
          </a>
        </div>
      </div>
      <div class="user-cell">${result.userDisplayName}</div>
    </div>
  </div>
`;

        const avatarContainer = document.querySelector(
          ".user-avatar-container"
        );
        const dropdown = avatarContainer.querySelector(".logout-dropdown");

        // Toggle dropdown on avatar click
        avatarContainer.addEventListener("click", (event) => {
          dropdown.style.display =
            dropdown.style.display === "block" ? "none" : "block";
          event.stopPropagation();
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", (event) => {
          if (!avatarContainer.contains(event.target)) {
            dropdown.style.display = "none";
          }
        });

        // Event listener for the logout button
        const logoutButton = document.getElementById("logoutButton");
        logoutButton.addEventListener("click", (e) => {
          e.preventDefault();
          chrome.runtime.sendMessage(
            { action: "disconnectTwitch" },
            function (response) {
              if (response && response.status === "success") {
                // Refresh the page upon successful logout
                window.location.reload();
                chrome.storage.local.set({ loginTipShown: false });
              }
            }
          );
        });

        // Show the login tip only if it hasn't been shown before
        if (!result.loginTipShown) {
          showLoginTip();
          chrome.storage.local.set({ loginTipShown: true });
        }
      } else {
        // No user info is available
        userInfoDiv.textContent = "Not logged in";
      }
    }
  );
}

function showLoginTip() {
  const tipContainer = document.createElement("div");
  tipContainer.id = "loginTip";
  tipContainer.style.backgroundColor = "#6441a5";
  tipContainer.style.color = "white";
  tipContainer.style.padding = "10px";
  tipContainer.style.borderRadius = "5px";
  tipContainer.style.marginTop = "10px";
  tipContainer.style.display = "flex";
  tipContainer.style.flexDirection = "column";
  tipContainer.style.alignItems = "center";
  tipContainer.style.justifyContent = "center";
  tipContainer.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";
  tipContainer.style.fontFamily = "'Arial', sans-serif";

  const tipText = document.createElement("span");
  tipText.textContent = "Pin popup extension for easy access!";
  tipText.style.textAlign = "center";
  tipContainer.appendChild(tipText);

  const tipImage = document.createElement("img");
  tipImage.src = "css/infopin.png";
  tipImage.alt = "Pin Icon";
  tipImage.style.width = "250px";
  tipImage.style.marginTop = "5px";
  tipContainer.appendChild(tipImage);

  const userInfoDiv = document.getElementById("userInfo");
  userInfoDiv.appendChild(tipContainer);

  // Remove the tip after a few seconds
  setTimeout(() => {
    tipContainer.remove();
  }, 7000);
}

// Listener for OAuth completion
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "oauthComplete") {
    // Fetch the latest data to check login status and followed channels
    chrome.storage.local.get(
      ["twitchAccessToken", "followedList"],
      function (result) {
        isLoggedIn = !!result.twitchAccessToken;
        hasFollowers = result.followedList && result.followedList.length > 0;

        // Now we update the UI based on the new status
        displayUserInfo(); // Refreshes user info display
        setTimeout(updatePreview, 2000); // Waits for 2 seconds before updating the preview

        // Optionally, we can also refresh other parts of our extension's UI
        // For example, refresh groups display
        displayGroups();
      }
    );
  }
});

// Function to toggle dark mode and update text
function toggleDarkMode(isDarkMode) {
  const themeSwitchText = document.getElementById("themeSwitchText");
  if (isDarkMode) {
    document.body.classList.add("dark-mode");
    themeSwitchText.textContent = "💡 Click it for light theme"; // When in dark mode
  } else {
    document.body.classList.remove("dark-mode");
    themeSwitchText.textContent = "🌙 Click it for dark theme"; // When in light mode
  }
}

// Event listener for the dark mode toggle
document.addEventListener("DOMContentLoaded", function () {
  // Load and set the "Show Avatar" preference
  chrome.storage.local.get("showAvatar", function (data) {
    var isShowAvatar = data.showAvatar !== undefined ? data.showAvatar : true; // Set default to true
    document.getElementById("showAvatarCheckbox").checked = isShowAvatar;
  });
  const darkModeToggle = document.getElementById("darkModeToggle");

  // Load dark mode setting
  chrome.storage.local.get("darkMode", function (data) {
    const isDarkMode = data.darkMode !== undefined ? data.darkMode : true; // Default to true
    darkModeToggle.checked = isDarkMode;
    toggleDarkMode(isDarkMode); // Also updates the text
  });

  // Save dark mode setting and update text
  darkModeToggle.addEventListener("change", function () {
    const isDarkMode = this.checked;
    chrome.storage.local.set({ darkMode: isDarkMode }, function () {
      toggleDarkMode(isDarkMode); // Also updates the text

      // Send a message to the background script
      chrome.runtime.sendMessage({ action: "oauthComplete" });
    });
  });
});

// Function to toggle dark mode in settings.html
function applyDarkModeSetting() {
  chrome.storage.local.get("darkMode", function (data) {
    var isDarkMode = data.darkMode !== undefined ? data.darkMode : true; // Default to true
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  });
}

// Apply dark mode setting when the page loads
document.addEventListener("DOMContentLoaded", applyDarkModeSetting);

document.addEventListener("DOMContentLoaded", function () {
  // Load and set the "Do not show accessed count" preference
  chrome.storage.local.get("hideAccessedCount", function (data) {
    var isChecked =
      data.hideAccessedCount !== undefined ? data.hideAccessedCount : false;
    document.getElementById("hideAccessedCountCheckbox").checked = isChecked;
    console.log("Loaded Hide Accessed Count preference:", isChecked);
  });

  // Save the "Do not show accessed count" preference when changed
  document
    .getElementById("hideAccessedCountCheckbox")
    .addEventListener("change", function () {
      var isChecked = this.checked;
      chrome.storage.local.set({ hideAccessedCount: isChecked }, function () {
        // Send a message to the background script
        chrome.runtime.sendMessage({ action: "oauthComplete" });
        console.log("Hide Accessed Count preference updated:", isChecked);
      });
    });
});

document.addEventListener("DOMContentLoaded", function () {
  // Get elements
  var checkbox = document.getElementById("enableNotificationsCheckbox");
  var labelText = document.querySelector(".bell-icon-label .label-text");

  // Load and set the notification preference
  chrome.storage.local.get("enableNotifications", function (data) {
    var isChecked =
      data.enableNotifications !== undefined ? data.enableNotifications : false;
    checkbox.checked = isChecked;
    updateLabelText(isChecked);
    console.log("Loaded Enable Notifications preference:", isChecked);
  });

  // Save the notification preference when changed and update label text
  checkbox.addEventListener("change", function () {
    var isChecked = this.checked;
    chrome.storage.local.set({ enableNotifications: isChecked }, function () {
      console.log("Enable Notifications preference updated:", isChecked);
    });
    updateLabelText(isChecked);
  });

  // Function to update the label text
  function updateLabelText(isChecked) {
    labelText.textContent = isChecked
      ? "Live Twitch Notifications Enabled"
      : "Enable Live Notifications";
  }
});

document.addEventListener("DOMContentLoaded", function () {
  // Load and set the stream grouping preference
  chrome.storage.local.get("streamGrouping", function (data) {
    var groupingPreference = data.streamGrouping || "none"; // Default to "none"
    document.getElementById("streamGroupingSelect").value = groupingPreference;
    console.log("Loaded Stream Grouping preference:", groupingPreference);
  });

  // Save the stream grouping preference when changed
  document
    .getElementById("streamGroupingSelect")
    .addEventListener("change", function () {
      var selectedOption = this.value;
      chrome.storage.local.set({ streamGrouping: selectedOption }, function () {
        // Send a message to the background script to update the stream list
        chrome.runtime.sendMessage({ action: "oauthComplete" });
        console.log("Stream Grouping preference updated:", selectedOption);
      });
    });
});