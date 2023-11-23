function displayGroups() {
  chrome.storage.local.get("favoriteGroups", function (data) {
    var groups = data.favoriteGroups || [];
    var groupListContainer = document.getElementById("groupListContainer");
    var favoriteListText = document.getElementById("favoriteListText");

    groupListContainer.innerHTML = "";

    if (groups.length === 0) {
      groupListContainer.innerHTML = `
      <p style="font-size: 16px; text-align: center;">
      <img src="css/nogroup.gif" style="display: block; margin: 0 auto;">
      <strong>No Favorite Groups Created Yet</strong><br><br>
      This is a list that will help you filter your favorite live streams from the popup into new category groups. <br><br>
      You can create a group and add any Twitch channel to it, organizing your streams.
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

        // Create the first column of streamers
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

          // Add Twitch icon
          var twitchIcon = document.createElement("img");
          twitchIcon.src = "css/twitch.png"; // Update with the correct path
          twitchIcon.alt = "Twitch";
          twitchIcon.style.width = "20px"; // Adjust size as needed
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

          // Append streamer item to the current list
          streamersList.appendChild(streamerItem);

          // If 5 streamers have been added or we reach the end, append the list and start a new one
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
        addStreamerBtn.className = "add-streamer-btn"; // Apply the class for styling
        addStreamerBtn.textContent = "Add a Twitch Channel";
        addStreamerBtn.onclick = function () {
          showAddStreamerDropdown(index);
          chrome.runtime.sendMessage({ action: "oauthComplete" });
        };
        buttonContainer.appendChild(addStreamerBtn);

        var deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-group-btn"; // Apply the class for styling
        deleteBtn.textContent = "Delete this list";
        deleteBtn.onclick = function () {
          chrome.runtime.sendMessage({ action: "oauthComplete" });
          deleteGroup(index);
          displayGroups();
        };
        buttonContainer.appendChild(deleteBtn);

        groupItem.appendChild(buttonContainer);
        groupList.appendChild(groupItem);
      });
      groupListContainer.appendChild(groupList);
    }
  });
}

// Global function to delete a streamer from a group
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

// Global function to delete a group
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

// Global function to get the followed list
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

// Global function to show the streamer dropdown
function showAddStreamerDropdown(groupIndex) {
  getFollowedList()
    .then((followedList) => {
      // Close any existing dropdown
      var existingDropdown = document.querySelector(".dropdown-menu");
      var existingOverlay = document.getElementById("dropdownOverlay");
      if (existingDropdown) {
        existingDropdown.remove();
      }
      if (existingOverlay) {
        existingOverlay.remove();
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
        dropdownItem.className = "dropdown-item"; // Add a class for styling

        // Create an image element for the Twitch logo
        var twitchLogo = document.createElement("img");
        twitchLogo.src = "css/twitch.png"; // Replace with the correct path to your Twitch logo image
        twitchLogo.alt = "Twitch Logo";
        twitchLogo.style.width = "13px"; // Adjust the size as needed

        // Append the Twitch logo and set it as the content of the dropdown item
        dropdownItem.appendChild(twitchLogo);
        dropdownItem.appendChild(document.createTextNode(" " + channel.broadcaster_name)); // Add a space before the channel name

        dropdownItem.onclick = function () {
          // Add Streamer to the group
          chrome.storage.local.get("favoriteGroups", function (data) {
            var groups = data.favoriteGroups || [];
            if (groups[groupIndex]) {
              groups[groupIndex].streamers.push(channel.broadcaster_name);

              chrome.storage.local.set({ favoriteGroups: groups }, function () {
                console.log(
                  "Streamer added:",
                  channel.broadcaster_name,
                  "to group",
                  groups[groupIndex].name
                );
                displayGroups(); // Refresh the displayed groups
                showTemporaryInfo("Channel added successfully!");
              });
            }
          });
          // Close the dropdown after selecting a channel
          closeDropdown();
        };
        dropdownMenu.appendChild(dropdownItem);
      });

      // Append the overlay and dropdown to the body
      document.body.appendChild(overlay);
      document.body.appendChild(dropdownMenu);
      dropdownMenu.style.display = "block";

      // Set width, position, and height of dropdown
      dropdownMenu.style.width = "300px";
      dropdownMenu.style.position = "absolute";
      dropdownMenu.style.overflowY = "auto";
      dropdownMenu.style.maxHeight = "400px";

      var screenWidth = window.innerWidth;
      var dropdownWidth = dropdownMenu.offsetWidth;
      var leftPosition = (screenWidth - dropdownWidth) / 2;
      dropdownMenu.style.left = `${leftPosition}px`;
      dropdownMenu.style.top = "50px";
      dropdownMenu.style.zIndex = "3";

      // Function to close dropdown and overlay
      function closeDropdown() {
        dropdownMenu.style.display = "none";
        overlay.style.display = "none";
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
    })
    .catch((error) => {
      console.error(error);
    });
}

// Global function to filter dropdown
function filterDropdown(dropdownMenu, searchValue) {
  var dropdownItems = dropdownMenu.getElementsByTagName("a");
  for (var i = 0; i < dropdownItems.length; i++) {
    var item = dropdownItems[i];
    var textValue = item.textContent || item.innerText;
    if (textValue.toLowerCase().indexOf(searchValue) > -1) {
      item.style.display = "";
    } else {
      item.style.display = "none";
    }
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
    if (liveStreams.length > 0) {
      // Select a random stream only if it has not been selected before
      if (!previewStream) {
        previewStream =
          liveStreams[Math.floor(Math.random() * liveStreams.length)];
      }

      var previewContainer = document.getElementById("previewContainer");
      previewContainer.innerHTML = ""; // Clear previous content

      var showAvatar = document.getElementById("showAvatarCheckbox").checked;

      var previewDiv = document.createElement("div");
      previewDiv.className = "stream-preview";

      if (showAvatar && previewStream.avatar) {
        var avatarImg = document.createElement("img");
        avatarImg.src = previewStream.avatar;
        avatarImg.className = "stream-avatar";
        avatarImg.style.width = "30px";
        avatarImg.style.height = "30px";
        avatarImg.style.borderRadius = "15px";
        avatarImg.style.marginRight = "5px";
        previewDiv.appendChild(avatarImg);
      }

      var channelNameSpan = document.createElement("span");
      channelNameSpan.textContent = previewStream.channelName;
      previewDiv.appendChild(channelNameSpan);

      // Add a space text node between channel name and viewers
      previewDiv.appendChild(document.createTextNode(" "));

      var viewersSpan = document.createElement("span");
      viewersSpan.innerHTML = `\u00A0- ${previewStream.viewers} viewers`;
      previewDiv.appendChild(viewersSpan);

      previewContainer.appendChild(previewDiv);
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
  infoDiv.style.backgroundColor = "#4CAF50"; // You can choose your color
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
  }, 3000); // Adjust time as needed
}

function displayUserInfo() {
  chrome.storage.local.get(
    ["userDisplayName", "userAvatar", "twitchAccessToken"],
    function (result) {
      const userInfoDiv = document.getElementById("userInfo");

      if (!result.twitchAccessToken) {
        const loginButton = document.createElement("button");
        loginButton.id = "loginButton";
        loginButton.textContent = "Login with Twitch";
        loginButton.classList.add("login-button"); // Use the class for styling

        loginButton.addEventListener("click", function () {
          // Optionally add a spinner or loading indication here
          chrome.runtime.sendMessage({ action: "startOAuth" });
        });

        userInfoDiv.appendChild(loginButton);
      } else if (result.userDisplayName && result.userAvatar) {
        // User is logged in, display their information
        userInfoDiv.innerHTML = `
        <div id="userTable">
          <div class="user-row">
            <div class="user-cell">Logged as:</div>
            <div class="user-cell user-avatar-container">
              <img src="${result.userAvatar}" alt="User Avatar" class="user-avatar">
              <div class="logout-dropdown">
                <a href="#" id="logoutButton">🔒 Logout</a>
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
          event.stopPropagation(); // Prevent document click event from firing immediately
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
              }
            }
          );
        });
      } else {
        // Case where the user is not logged in and no user info is available
        userInfoDiv.textContent = "Not logged in";
      }
    }
  );
}

// Listener for OAuth completion in settings.js
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "oauthComplete") {
    // Update UI or reload the page to reflect the login state
    displayUserInfo(); // Or you can use window.location.reload() to refresh the entire page
  }
});

// Function to toggle dark mode and update text
function toggleDarkMode(isDarkMode) {
  const themeSwitchText = document.getElementById('themeSwitchText');
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    themeSwitchText.textContent = '💡 Click it for light theme'; // When in dark mode
  } else {
    document.body.classList.remove('dark-mode');
    themeSwitchText.textContent = '🌙 Click it for dark theme'; // When in light mode
  }
}

// Event listener for the dark mode toggle
document.addEventListener('DOMContentLoaded', function() {
  const darkModeToggle = document.getElementById('darkModeToggle');

  // Load dark mode setting
  chrome.storage.local.get('darkMode', function(data) {
    const isDarkMode = data.darkMode || false;
    darkModeToggle.checked = isDarkMode;
    toggleDarkMode(isDarkMode); // Also updates the text
  });

  // Save dark mode setting and update text
  darkModeToggle.addEventListener('change', function() {
    const isDarkMode = this.checked;
    chrome.storage.local.set({ 'darkMode': isDarkMode }, function() {
      toggleDarkMode(isDarkMode); // Also updates the text

      // Send a message to the background script
      chrome.runtime.sendMessage({ action: "oauthComplete" });
    });
  });
});

