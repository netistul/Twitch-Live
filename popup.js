document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded event triggered");

  applyDarkMode();
  updateSettingsIcon();

  // Update live streams immediately for all users
  updateLiveStreams();

  // Delay checking login status to ensure smooth rendering
  setTimeout(checkLoginAndDisplayButton, 100);
  updateSettingsIcon();

  // Set an interval to update live streams and check login status every 30 seconds
  setInterval(function () {
    updateLiveStreams();
    setTimeout(checkLoginAndDisplayButton, 100);
  }, 30000);

  // Accessing buttonContainer & spinner element
  const buttonContainer = document.getElementById("buttonContainer");
  console.log("buttonContainer:", buttonContainer);

  // Create the spinner element for loading
  const spinner = document.createElement("img");
  spinner.id = "spinner";
  spinner.src = "css/loading.webp";
  spinner.style.display = "none";

  // Settings icon handling with hover effects
  const settingsIcon = document.getElementById("settingsIcon");
  let originalSrc = settingsIcon.src; // Store the original image source

  settingsIcon.addEventListener("mouseenter", function () {
    // Add rotation class
    this.classList.add('rotating');

    // Store the original source and change to emoji
    settingsIcon.setAttribute('data-original-src', settingsIcon.src);
    settingsIcon.src = 'css/cog.png'; // Change to the path of your settings/cog icon
    // Alternative: use emoji directly
    // this.outerHTML = '<div id="settingsIcon" class="rotating">⚙️</div>';
  });

  settingsIcon.addEventListener("mouseleave", function () {
    // Get original source and restore it
    const originalSrc = settingsIcon.getAttribute('data-original-src');
    if (originalSrc) {
      settingsIcon.src = originalSrc;
    }

    // Remove rotation class after animation completes
    setTimeout(() => {
      this.classList.remove('rotating');
    }, 500);
  });

  // Settings click handler
  settingsIcon.addEventListener("click", function () {
    var screenWidth = 585;
    var screenHeight = Math.min(window.screen.availHeight, 730);

    window.open(
      "settings.html",
      "ExtensionSettings",
      "width=" + screenWidth + ",height=" + screenHeight
    );
  });

  // Listener for OAuth completion
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "oauthComplete") {
      applyDarkMode();
      spinner.style.display = "none"; // Hide the spinner

      // Start an interval to refresh every 500ms
      let refreshInterval = setInterval(updateLiveStreams, 500);

      // Stop refreshing after 2 seconds
      setTimeout(() => {
        clearInterval(refreshInterval);
      }, 2000);
    }
  });
});

function checkLoginAndDisplayButton() {
  chrome.storage.local.get(
    ["twitchAccessToken", "tokenExpired"],
    function (result) {
      if (!result.twitchAccessToken) {
        // result.tokenExpired will be undefined (falsy) if not set, which is equivalent to false
        displayLoginButton(result.tokenExpired); // This is safe; it will behave as if false if undefined
      } else {
        updateLiveStreams();
      }
    }
  );
}

function displayLoginButton(sessionExpired = false) {
  const buttonContainer = document.getElementById("buttonContainer");

  // Create the spinner element for loading
  const spinner = document.createElement("img");
  spinner.id = "spinner";
  spinner.src = "css/loading.webp";
  spinner.style.display = "none"; // Start hidden until needed

  // Create the login button
  const loginButton = document.createElement("button");
  loginButton.id = "loginButton";
  loginButton.textContent = "Login with Twitch";
  loginButton.addEventListener("click", function () {
    // Clear any previous content when login is initiated
    buttonContainer.innerHTML = "";
    spinner.style.display = "block"; // Show the spinner when login is initiated
    // Append spinner to the button container when the login button is clicked
    buttonContainer.appendChild(spinner);
    chrome.runtime.sendMessage({ action: "startOAuth" });
  });

  // Clear any previous content
  buttonContainer.innerHTML = "";

  // If the session has expired, display a notification message
  if (sessionExpired) {
    const expirationMessage = document.createElement("div");
    expirationMessage.textContent =
      "Your session has expired. Please log in again.";
    expirationMessage.style.color = "#b41541";
    expirationMessage.style.marginBottom = "10px";
    expirationMessage.style.fontSize = "14px";
    buttonContainer.appendChild(expirationMessage);
  }

  buttonContainer.appendChild(loginButton);

  // Create and append the description text
  const description = document.createElement("div");
  description.textContent =
    "Log in with Twitch to see live channels you follow!";
  description.id = "description";
  buttonContainer.appendChild(description);

  // Create and append the not logged in icon
  const notLoggedInIcon = document.createElement("img");
  notLoggedInIcon.src = "css/notlogged.webp";
  notLoggedInIcon.alt = "Not Logged In";
  notLoggedInIcon.style.height = "auto";
  notLoggedInIcon.style.marginTop = "10px";
  notLoggedInIcon.style.display = "block";
  notLoggedInIcon.style.marginLeft = "auto";
  notLoggedInIcon.style.marginRight = "auto";
  buttonContainer.appendChild(notLoggedInIcon);
}

function updateLiveStreams() {
  chrome.storage.local.get(
    [
      "liveStreams",
      "favoriteGroups",
      "showAvatar",
      "channelAccess",
      "hideAccessedCount",
      "streamGrouping",
    ],
    function (result) {
      const liveStreams = result.liveStreams || [];
      const favoriteGroups = result.favoriteGroups || [];
      const showAvatar =
        result.showAvatar !== undefined ? result.showAvatar : true;
      const channelAccess = result.channelAccess || {};
      const hideAccessedCount =
        result.hideAccessedCount !== undefined
          ? result.hideAccessedCount
          : false;
      const streamGrouping = result.streamGrouping || "none";
      // Default to true

      // Sort channels based on access count
      liveStreams.sort(
        (a, b) =>
          (channelAccess[b.broadcasterLogin] || 0) -
          (channelAccess[a.broadcasterLogin] || 0)
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
        channelLink.href = `https://www.twitch.tv/${stream.broadcasterLogin}`;
        channelLink.className = "stream-info";
        channelLink.target = "_blank";

        channelLink.addEventListener("click", function (event) {
          event.preventDefault(); // Prevent the default link behavior immediately
          incrementChannelAccess(stream.broadcasterLogin);

          // Use setTimeout to delay the redirection
          setTimeout(() => {
            window.open(channelLink.href, "_blank");
          }, 10); // Delay in milliseconds, 10 is just an example
        });

        const wrapperDiv = document.createElement("div");
        wrapperDiv.className = "channel-category-wrapper";

        // Sub-wrapper for channel name, category, and viewers
        const subWrapper = document.createElement("div");
        subWrapper.className = showAvatar ? "sub-wrapper-with-avatar" : "";

        let avatarImg;
        if (showAvatar && stream.avatar) {
          avatarImg = document.createElement("img");
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
        channelNameSpan.style.textAlign = "left";

        // Create tooltip span and append it to channelNameSpan
        const tooltipSpan = document.createElement("span");
        tooltipSpan.className = "custom-tooltip";
        tooltipSpan.textContent = stream.title;
        channelNameSpan.appendChild(tooltipSpan);

        // Event listeners for showing and positioning the tooltip
        channelNameSpan.addEventListener("mousemove", function (e) {
          const tooltipHeight = tooltipSpan.offsetHeight;
          const x = e.clientX;
          const y = e.clientY;
          const padding = 10;
          const fromBottom = window.innerHeight - e.clientY;

          // Check if there is enough space at the bottom, if not show tooltip above the cursor
          if (fromBottom < tooltipHeight + padding) {
            tooltipSpan.style.top = y - tooltipHeight - padding + "px";
          } else {
            tooltipSpan.style.top = y + padding + "px";
          }

          tooltipSpan.style.left = x + padding + "px";
        });

        const categoryDiv = document.createElement("div");
        categoryDiv.style.textAlign = "left";

        if (showAvatar && stream.avatar) {
          channelNameSpan.classList.add("with-avatar");
          categoryDiv.appendChild(channelNameSpan);

          const categorySpan = document.createElement("span");
          categorySpan.className = "stream-category-with-avatar";
          categorySpan.textContent = stream.category;
          categorySpan.style.textAlign = "left";
          categoryDiv.appendChild(categorySpan);
          subWrapper.appendChild(categoryDiv);
        } else {
          wrapperDiv.appendChild(channelNameSpan);
        }

        // Create the tooltip for the access count
        let tooltip;
        if (hideAccessedCount) {
          const accessCount = channelAccess[stream.broadcasterLogin] || 0;
          tooltip = document.createElement("div");
          tooltip.className = "avatar-tooltip";
          tooltip.textContent = `Accessed: ${accessCount} times`;
          tooltip.style.position = "absolute";
          tooltip.style.display = "none";
          tooltip.style.padding = "5px";
          tooltip.style.background = "rgba(0, 0, 0, 0.8)";
          tooltip.style.color = "white";
          tooltip.style.borderRadius = "3px";
          tooltip.style.zIndex = "1000";
          document.body.appendChild(tooltip);

          // Add hover event listeners to the avatar image
          if (avatarImg) {
            avatarImg.addEventListener("mouseover", function (e) {
              tooltip.style.display = "block";
              tooltip.style.left = e.pageX + 10 + "px";
              tooltip.style.top = e.pageY + 10 + "px";
            });

            avatarImg.addEventListener("mousemove", function (e) {
              tooltip.style.left = e.pageX + 10 + "px";
              tooltip.style.top = e.pageY + 10 + "px";
            });

            avatarImg.addEventListener("mouseout", function () {
              tooltip.style.display = "none";
            });
          }
        }

        if (!showAvatar || !stream.avatar) {
          const categorySpan = document.createElement("span");
          categorySpan.className = "stream-category";
          categorySpan.textContent = stream.category;
          categorySpan.style.textAlign = "left";
          wrapperDiv.appendChild(categorySpan);
        }

        const viewersWrapper = document.createElement("div");
        viewersWrapper.className = showAvatar
          ? "viewers-wrapper-with-avatar"
          : "viewers-wrapper";

        const viewersSpan = document.createElement("span");
        viewersSpan.className = "viewers";
        viewersSpan.textContent = stream.viewers;
        viewersWrapper.appendChild(viewersSpan);

        // Include SVG icon only if showAvatar and stream.avatar are true
        if (showAvatar && stream.avatar) {
          const iconImg = document.createElement("img");
          iconImg.src = "css/signal.svg";
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

        // Add contextmenu event listener
        channelItem.addEventListener("contextmenu", function (event) {
          event.preventDefault(); // Prevent default browser context menu
          showContextMenu(stream, event.pageX, event.pageY);
          return false; // Prevent further handling
        });

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

      // If grouping by game is enabled
      if (streamGrouping === "game" && ungroupedStreams.length > 0) {
        // Group streams by game name
        const gameGroups = {};
        ungroupedStreams.forEach(stream => {
          const gameName = stream.category || "Other";
          if (!gameGroups[gameName]) {
            gameGroups[gameName] = [];
          }
          gameGroups[gameName].push(stream);
        });

        // Sort game names alphabetically
        const sortedGameNames = Object.keys(gameGroups).sort();

        // Create headers and add streams for each game group
        sortedGameNames.forEach((gameName, gameIndex) => {
          const gameHeader = document.createElement("h3");
          gameHeader.textContent = gameName.toUpperCase();
          gameHeader.classList.add("group-header");
          scrollContainer.appendChild(gameHeader);

          // Add all streams for this game
          gameGroups[gameName].forEach((stream, streamIndex) => {
            appendStreamLink(stream, scrollContainer);

            // Add margin to the last stream in the last game group
            if (gameIndex === sortedGameNames.length - 1 &&
              streamIndex === gameGroups[gameName].length - 1) {
              const lastStreamItem = scrollContainer.lastChild;
              lastStreamItem.style.marginBottom = "5px";
            }
          });
        });
      } else {
        // Original behavior remains the same
        if (ungroupedStreams.length > 0 && isAnyFavoriteGroupLive) {
          const otherChannelsHeader = document.createElement("h3");
          otherChannelsHeader.textContent = "MORE LIVE TWITCH CHANNELS";
          otherChannelsHeader.classList.add("group-header");
          scrollContainer.appendChild(otherChannelsHeader);
        }

        ungroupedStreams.forEach((stream, index) => {
          appendStreamLink(stream, scrollContainer);

          if (index === ungroupedStreams.length - 1) {
            const lastStreamItem = scrollContainer.lastChild;
            lastStreamItem.style.marginBottom = "5px";
          }
        });
      }

      container.appendChild(scrollContainer);
      container.scrollTop = currentScrollPosition;
    }
  );
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
    var isDarkMode = data.darkMode !== undefined ? data.darkMode : true;
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  });
}

/* Custom scrollbar for Firefox */
if (navigator.userAgent.includes("Firefox")) {
  document.body.style.scrollbarWidth = "thin";
  document.body.style.scrollbarColor = "#6441a5 #efeff1";
}

/* add to favorite list */
function showContextMenu(stream, x, y) {
  const existingMenu = document.querySelector(".custom-context-menu");
  if (existingMenu) {
    existingMenu.remove();
  }

  const contextMenu = document.createElement("div");
  contextMenu.className = "custom-context-menu";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  // Header for the context menu updated to include the Twitch logo and the text properly
  const menuHeader = document.createElement("div");
  menuHeader.className = "context-menu-header";

  // Text "Add"
  const addActionText = document.createElement("span");
  addActionText.textContent = "Add ";
  addActionText.style.marginRight = "2px"; // Adds a small right margin
  addActionText.style.verticalAlign = "middle";

  // Twitch icon
  const twitchIcon = document.createElement("img");
  twitchIcon.src = "css/twitch.png";
  twitchIcon.alt = "Twitch";
  twitchIcon.style.width = "15px";
  twitchIcon.style.marginRight = "2px";
  twitchIcon.style.verticalAlign = "middle";

  // Channel name
  const channelNameSpan = document.createElement("span");
  channelNameSpan.textContent = `${stream.channelName}`;
  channelNameSpan.style.marginRight = "5px";
  channelNameSpan.style.verticalAlign = "middle";
  channelNameSpan.style.color = "#9182c1";

  // Text "to favorite list:"
  const toFavoriteGroupText = document.createElement("span");
  toFavoriteGroupText.textContent = "to favorite list:";
  toFavoriteGroupText.style.verticalAlign = "middle";

  // Construct the header
  menuHeader.appendChild(addActionText); // Adds "Add"
  menuHeader.appendChild(twitchIcon); // Adds Twitch icon
  menuHeader.appendChild(channelNameSpan); // Adds the channel name
  menuHeader.appendChild(toFavoriteGroupText); // Adds "to favorite group:"
  contextMenu.appendChild(menuHeader);

  chrome.storage.local.get("favoriteGroups", function (data) {
    const groups = data.favoriteGroups || [];
    if (groups.length > 0) {
      groups.forEach((group, index) => {
        const menuItem = document.createElement("div");
        menuItem.className = "context-menu-item";

        const checkBox = document.createElement("input");
        checkBox.type = "checkbox";
        checkBox.checked = group.streamers.includes(stream.channelName);

        const groupNameSpan = document.createElement("span");
        groupNameSpan.className = "group-name";
        groupNameSpan.textContent = group.name;

        // Create delete button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete this entire list";
        deleteButton.className = "delete-group-button";
        deleteButton.style.display = "none"; // Initially hidden
        deleteButton.onclick = function (event) {
          event.stopPropagation(); // Prevent triggering the menuItem click
          deleteGroup(index, contextMenu);
        };

        menuItem.appendChild(checkBox);
        menuItem.appendChild(groupNameSpan);
        menuItem.appendChild(deleteButton);
        contextMenu.appendChild(menuItem);

        // Show delete button on hover
        menuItem.onmouseenter = function () {
          deleteButton.style.display = "block";
        };
        menuItem.onmouseleave = function () {
          deleteButton.style.display = "none";
        };

        menuItem.addEventListener("click", function (event) {
          if (event.target !== checkBox) {
            checkBox.checked = !checkBox.checked; // Toggle checkbox manually
            checkBox.dispatchEvent(new Event("change")); // Fire the change event manually
          }
        });

        checkBox.addEventListener("change", function () {
          if (checkBox.checked) {
            addToGroup(stream, group.name);
          } else {
            removeFromGroup(stream, group.name);
          }
        });
      });
    } else {
      const noGroupItem = document.createElement("div");
      noGroupItem.textContent = "No favorite groups found.";
      noGroupItem.className = "context-menu-item";
      contextMenu.appendChild(noGroupItem);
    }

    // Add new group option
    const addNewGroupItem = document.createElement("div");
    addNewGroupItem.textContent = "➕ Add new favorite list";
    addNewGroupItem.className = "context-menu-item add-new-group-button";
    addNewGroupItem.onclick = function () {
      openAddGroupForm(contextMenu, stream);
    };

    contextMenu.appendChild(addNewGroupItem);
    document.body.appendChild(contextMenu);

    // Position adjustment to prevent out-of-bounds
    const menuRect = contextMenu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      contextMenu.style.left = `${window.innerWidth - menuRect.width}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
      contextMenu.style.top = `${window.innerHeight - menuRect.height}px`;
    }
  });

  // Close the context menu when clicking outside
  document.addEventListener(
    "click",
    function closeMenu(event) {
      if (!contextMenu.contains(event.target)) {
        contextMenu.remove();
        document.removeEventListener("click", closeMenu);
      }
    },
    { capture: true }
  );
}

function addToGroup(stream, groupName) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    const groups = data.favoriteGroups || [];
    const group = groups.find((g) => g.name === groupName);
    if (group && !group.streamers.includes(stream.channelName)) {
      // Check using channelName
      group.streamers.push(stream.channelName);
      chrome.storage.local.set({ favoriteGroups: groups }, function () {
        console.log(`Added ${stream.channelName} to ${groupName}`);
        updateLiveStreams();
      });
    }
  });
}

function removeFromGroup(stream, groupName) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    const groups = data.favoriteGroups || [];
    const group = groups.find((g) => g.name === groupName);
    if (group) {
      group.streamers = group.streamers.filter((s) => s !== stream.channelName);
      chrome.storage.local.set({ favoriteGroups: groups }, function () {
        console.log(`Removed ${stream.channelName} from ${groupName}`);
        updateLiveStreams();
      });
    }
  });
}

function createNewGroup(groupName, stream, contextMenu) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    const groups = data.favoriteGroups || [];
    // Check if the group already exists to avoid duplicates
    if (!groups.some((g) => g.name === groupName)) {
      const newGroup = {
        name: groupName,
        streamers: [stream.channelName],
      };
      groups.push(newGroup);
      chrome.storage.local.set({ favoriteGroups: groups }, function () {
        console.log(
          `New group '${groupName}' created and added ${stream.channelName}`
        );
        // update list
        updateLiveStreams();
        // Add the new group to the context menu in real time
        const menuItem = document.createElement("div");
        menuItem.className = "context-menu-item";

        const checkBox = document.createElement("input");
        checkBox.type = "checkbox";
        checkBox.checked = true;

        const groupNameSpan = document.createElement("span");
        groupNameSpan.className = "group-name"; // Add this line
        groupNameSpan.textContent = groupName;

        // Create delete button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete this entire list";
        deleteButton.className = "delete-group-button";
        deleteButton.style.display = "none"; // Initially hidden
        deleteButton.onclick = function (event) {
          event.stopPropagation(); // Prevent triggering the menuItem click
          deleteGroup(groups.length - 1, contextMenu);
        };

        menuItem.appendChild(checkBox);
        menuItem.appendChild(groupNameSpan);
        menuItem.appendChild(deleteButton);
        contextMenu.insertBefore(menuItem, contextMenu.lastChild); // Add before the "Add new favorite list" button

        // Show delete button on hover
        menuItem.onmouseenter = function () {
          deleteButton.style.display = "block";
        };
        menuItem.onmouseleave = function () {
          deleteButton.style.display = "none";
        };

        menuItem.addEventListener("click", function (event) {
          if (event.target !== checkBox) {
            checkBox.checked = !checkBox.checked;
            checkBox.dispatchEvent(new Event("change"));
          }
        });

        checkBox.addEventListener("change", function () {
          if (checkBox.checked) {
            addToGroup(stream, groupName);
          } else {
            removeFromGroup(stream, groupName);
          }
        });
      });
    } else {
      alert("A group with this name already exists.");
    }
  });
}

function openAddGroupForm(contextMenu, stream) {
  // Create form container if it doesn't exist
  let formContainer = contextMenu.querySelector(".new-group-form");
  if (!formContainer) {
    formContainer = document.createElement("div");
    formContainer.className = "new-group-form";

    // Create input for group name
    const groupNameInput = document.createElement("input");
    groupNameInput.type = "text";
    groupNameInput.placeholder = "Enter new group name";
    groupNameInput.className = "group-name-input";

    // Create submit button
    const submitButton = document.createElement("button");
    submitButton.textContent = "Submit";
    submitButton.className = "submit-new-group";

    // Append elements to the form container
    formContainer.appendChild(groupNameInput);
    formContainer.appendChild(submitButton);

    // Append the form to the context menu before the add new group item
    const addNewGroupButton = contextMenu.querySelector(
      ".add-new-group-button"
    ); // Ensure this class is set correctly where the button is created
    contextMenu.insertBefore(formContainer, addNewGroupButton);

    // Focus on the input field automatically
    groupNameInput.focus();

    // Handle form submission
    submitButton.onclick = function () {
      const groupName = groupNameInput.value.trim();
      if (groupName) {
        createNewGroup(groupName, stream, contextMenu);
        formContainer.remove(); // Remove form after submission
      } else {
        alert("Please enter a valid group name.");
      }
    };

    // Handle Enter key press
    groupNameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        const groupName = groupNameInput.value.trim();
        if (groupName) {
          createNewGroup(groupName, stream, contextMenu);
          formContainer.remove(); // Remove form after submission
        } else {
          alert("Please enter a valid group name.");
        }
      }
    });
  }
}

function deleteGroup(index, contextMenu) {
  chrome.storage.local.get("favoriteGroups", function (data) {
    var groups = data.favoriteGroups || [];
    if (index >= 0 && index < groups.length) {
      groups.splice(index, 1); // Remove the group from the array
      chrome.storage.local.set({ favoriteGroups: groups }, function () {
        console.log("Group deleted");

        // Remove the group from the context menu
        const menuItem = contextMenu.childNodes[index + 1]; // Adjusting index to account for header
        if (menuItem) {
          contextMenu.removeChild(menuItem);
        }

        updateLiveStreams(); // Refresh streams if needed
      });
    } else {
      console.log("Invalid index for deletion.");
    }
  });
}
