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
            This is a list that will help you filter your favorite live streams from the popup into new category groups.
            <br><br>
            You can create a group and add any Twitch channel to it, organizing your streams.
          </p>
          <div class="info-box">
            💡 You can also do this from the popup by right-clicking on any stream channel and selecting an existing group or creating a new one.
          </div>
        `;
      } else {
        var groupList = document.createElement("ul");
        groupList.id = "groupList";

        groups.forEach(function (group, index) {
          var groupItem = document.createElement("li");
          groupItem.classList.add("group-item");

          var groupNameContainer = document.createElement("div");
          groupNameContainer.className = "group-name-container";
          var groupNameSpan = document.createElement("span");
          groupNameSpan.textContent = group.name;
          groupNameSpan.className = "group-name";
          var editGroupBtn = document.createElement("button");
          editGroupBtn.textContent = "✏️";
          editGroupBtn.className = "edit-group-btn-settings";

          const enterEditMode = () => {
            groupNameSpan.contentEditable = true;
            groupNameSpan.classList.add("editing");
            groupNameSpan.focus();

            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(groupNameSpan);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);

            const originalName = groupNameSpan.textContent;

            const saveEdit = () => {
              const newName = groupNameSpan.textContent.trim();
              if (newName && newName !== originalName) {
                chrome.storage.local.get("favoriteGroups", function (data) {
                  var groups = data.favoriteGroups || [];
                  if (groups[index]) {
                    groups[index].name = newName;
                    chrome.storage.local.set({ favoriteGroups: groups }, function () {
                      console.log("Group name updated:", newName);
                    });
                  }
                });
              } else if (!newName) {
                groupNameSpan.textContent = originalName;
              }
              groupNameSpan.contentEditable = false;
              groupNameSpan.classList.remove("editing");
            };

            groupNameSpan.onkeydown = function (e) {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
                groupNameSpan.blur();
              } else if (e.key === 'Escape') {
                groupNameSpan.textContent = originalName;
                groupNameSpan.contentEditable = false;
                groupNameSpan.classList.remove("editing");
                groupNameSpan.blur();
              }
            };

            groupNameSpan.onblur = saveEdit;
          };

          groupNameSpan.onclick = enterEditMode;
          editGroupBtn.onclick = enterEditMode;
          groupNameSpan.style.cursor = "pointer";

          groupNameContainer.appendChild(groupNameSpan);
          groupNameContainer.appendChild(editGroupBtn);
          groupItem.appendChild(groupNameContainer);

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
            deleteStreamerBtn.textContent = "❌";
            deleteStreamerBtn.style.width = "24px";
            deleteStreamerBtn.style.background = "transparent";
            deleteStreamerBtn.style.border = "none";
            deleteStreamerBtn.style.cursor = "pointer";
            deleteStreamerBtn.style.padding = "2px";
            deleteStreamerBtn.style.fontSize = "12px";
            deleteStreamerBtn.style.opacity = "0.6";
            deleteStreamerBtn.style.transition = "all 0.2s ease";

            deleteStreamerBtn.onmouseover = function () {
              this.style.opacity = "1";
              this.style.transform = "scale(1.2)";
            };

            deleteStreamerBtn.onmouseout = function () {
              this.style.opacity = "0.6";
              this.style.transform = "scale(1)";
            };

            deleteStreamerBtn.onclick = function () {
              deleteStreamer(index, streamerIndex);
            };

            streamerItem.appendChild(deleteStreamerBtn);
            streamersList.appendChild(streamerItem);
          });

          // Append the streamersList after all streamers are added
          groupItem.appendChild(streamersList);

          var buttonContainer = document.createElement("div");
          buttonContainer.classList.add("button-container");

          var addStreamerBtn = document.createElement("button");
          addStreamerBtn.className = "add-streamer-btn";
          addStreamerBtn.textContent = "➕ Add twitch channel";

          if (isLoggedIn && hasFollowers) {
            addStreamerBtn.onclick = function () {
              showAddStreamerDropdown(index);
              chrome.runtime.sendMessage({ action: "oauthComplete" });
            };
          } else {
            addStreamerBtn.onclick = function () {
              alert("Log in or follow more streamers to have Twitch channels here!");
            };
          }

          buttonContainer.appendChild(addStreamerBtn);

          var deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-group-btn";
          deleteBtn.textContent = "Delete list";
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
  getFollowedList().then((followedList) => {
    document.querySelectorAll(".dropdown-menu, #dropdownOverlay").forEach(el => el.remove());

    const overlay = document.createElement("div");
    overlay.id = "dropdownOverlay";
    document.body.appendChild(overlay);

    const dropdownMenu = document.createElement("div");
    dropdownMenu.className = "dropdown-menu";
    document.body.appendChild(dropdownMenu);

    const dropdownHeader = document.createElement("div");
    dropdownHeader.className = "dropdown-header";
    dropdownMenu.appendChild(dropdownHeader);

    const dropdownTitle = document.createElement("h3");
    dropdownTitle.className = "dropdown-title";
    dropdownHeader.appendChild(dropdownTitle);

    const dropdownContent = document.createElement("div");
    dropdownContent.className = "dropdown-content";
    dropdownMenu.appendChild(dropdownContent);

    chrome.storage.local.get("favoriteGroups", (data) => {
      const groups = data.favoriteGroups || [];
      const groupName = groups[groupIndex]?.name || "Unknown";
      const currentStreamers = groups[groupIndex]?.streamers || [];

      // Create title part
      const titleText = document.createElement("span");
      titleText.className = "list-title";
      titleText.textContent = "Add to list:";

      const spaceText = document.createElement("span");

      const listNameSpan = document.createElement("span");
      listNameSpan.className = "list-name";
      listNameSpan.textContent = groupName;

      dropdownTitle.appendChild(titleText);
      dropdownTitle.appendChild(spaceText);
      dropdownTitle.appendChild(listNameSpan);

      const searchContainer = document.createElement("div");
      searchContainer.className = "dropdown-search-container";
      dropdownContent.appendChild(searchContainer);

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "dropdown-search";
      searchInput.placeholder = `Search streamer... (${followedList.length})`;
      searchContainer.appendChild(searchInput);

      const itemsContainer = document.createElement("div");
      itemsContainer.className = "dropdown-items-container";
      dropdownContent.appendChild(itemsContainer);

      // Group streamers by first letter
      const groupedStreamers = {};
      followedList.forEach(channel => {
        const firstLetter = channel.broadcaster_name.charAt(0).toUpperCase();
        if (!groupedStreamers[firstLetter]) {
          groupedStreamers[firstLetter] = [];
        }
        groupedStreamers[firstLetter].push(channel);
      });

      // Sort letters alphabetically
      const sortedLetters = Object.keys(groupedStreamers).sort();

      // Create sections for each letter
      sortedLetters.forEach((letter, index) => {
        const letterHeader = document.createElement("div");
        letterHeader.className = "dropdown-letter-header";
        if (index === 0) {
          letterHeader.classList.add("first-letter-header");
        }
        letterHeader.textContent = letter;
        itemsContainer.appendChild(letterHeader);

        // Sort streamers in this letter group alphabetically
        groupedStreamers[letter].sort((a, b) =>
          a.broadcaster_name.localeCompare(b.broadcaster_name)
        );

        // Add streamers for this letter
        groupedStreamers[letter].forEach(channel => {
          const isAdded = currentStreamers.includes(channel.broadcaster_name);

          const item = document.createElement("div");
          item.className = `dropdown-item ${isAdded ? "added" : ""}`;
          item.style.cursor = "pointer";

          const twitchLogo = document.createElement("img");
          twitchLogo.src = "css/twitch.png";
          twitchLogo.className = "dropdown-twitch-logo";

          const channelName = document.createElement("span");
          channelName.className = "dropdown-channel-name";
          channelName.textContent = channel.broadcaster_name;

          const heart = document.createElement("div");
          heart.className = `dropdown-heart ${isAdded ? "added" : ""}`;

          item.addEventListener("click", (e) => {
            if (!heart.contains(e.target)) {  // Only trigger if not clicking the heart itself
              toggleChannel(channel, heart);
            }
          });

          heart.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleChannel(channel, heart);
          });

          function toggleChannel(channel, heartElement) {
            chrome.storage.local.get("favoriteGroups", (data) => {
              const groups = data.favoriteGroups || [];
              if (groups[groupIndex]) {
                const streamers = groups[groupIndex].streamers;
                const channelName = channel.broadcaster_name;
                const wasAdded = streamers.includes(channelName);

                if (wasAdded) {
                  groups[groupIndex].streamers = streamers.filter(name => name !== channelName);
                  heartElement.classList.remove("added");
                  item.classList.remove("added");
                } else {
                  groups[groupIndex].streamers.push(channelName);
                  heartElement.classList.add("added");
                  item.classList.add("added");
                }

                chrome.storage.local.set({ favoriteGroups: groups }, () => {
                  displayGroups();
                  showTemporaryInfo(`${wasAdded ? 'Removed' : 'Added'} ${channelName} ${wasAdded ? 'from' : 'to'} list ${groupName}`);
                });
              }
            });
          }

          item.append(twitchLogo, channelName, heart);
          itemsContainer.appendChild(item);
        });
      });

      searchInput.addEventListener("input", (e) => {
        const searchValue = e.target.value.toLowerCase();
        let hasVisibleItems = false;

        // Hide all items and headers first
        Array.from(itemsContainer.children).forEach(child => {
          child.style.display = "none";
        });

        // Show matching items and their headers
        Array.from(itemsContainer.getElementsByClassName("dropdown-item"))
          .forEach(item => {
            const name = item.querySelector(".dropdown-channel-name").textContent.toLowerCase();
            if (name.includes(searchValue)) {
              item.style.display = "flex";
              hasVisibleItems = true;
              // Show the letter header for this item
              let prev = item.previousElementSibling;
              while (prev && !prev.classList.contains("dropdown-letter-header")) {
                prev = prev.previousElementSibling;
              }
              if (prev && prev.classList.contains("dropdown-letter-header")) {
                prev.style.display = "block";
              }
            }
          });

        // If search is empty, show all items and headers
        if (!searchValue) {
          Array.from(itemsContainer.children).forEach(child => {
            child.style.display = child.classList.contains("dropdown-letter-header") ? "block" : "flex";
          });
        }
      });

      dropdownMenu.style.display = "block";
      overlay.style.display = "block";

      overlay.addEventListener("click", () => {
        dropdownMenu.remove();
        overlay.remove();
      });
    });
  }).catch(console.error);
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

// DOMContentLoaded event listener for add new fav group
document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("myModal");
  const btn = document.getElementById("addFavoriteGroupButton");
  const saveButton = document.getElementById("saveGroup");
  const groupNameInput = document.getElementById("groupName");

  // Modal control functions
  btn.onclick = () => modal.style.display = "flex"; // Changed to "flex" to match CSS

  document.querySelector('.btn-cancel')?.addEventListener('click', () => {
    modal.style.display = "none";
  });

  window.onclick = (event) => {
    if (event.target === modal) modal.style.display = "none";
  };

  // Save group functionality
  saveButton.addEventListener("click", function () {
    const groupName = groupNameInput.value.trim();
    if (!groupName) {
      console.log("No group name entered");
      return;
    }

    chrome.storage.local.get("favoriteGroups", (data) => {
      const groups = data.favoriteGroups || [];
      groups.push({ name: groupName, streamers: [] });

      chrome.storage.local.set({ favoriteGroups: groups }, () => {
        console.log("Group saved:", groupName);
        modal.style.display = "none";
        displayGroups();
      });
    });
  });

  // Input validation
  saveButton.disabled = true;
  groupNameInput.addEventListener("input", function () {
    saveButton.disabled = this.value.trim() === "";
  });

  // Load and set the "Show Avatar" preference
  chrome.storage.local.get("showAvatar", function (data) {
    const isShowAvatar = data.showAvatar !== undefined ? data.showAvatar : true; // Default to true
    const checkbox = document.getElementById("showAvatarCheckbox");
    checkbox.checked = isShowAvatar;

    // Save the default value if it's a new installation
    if (data.showAvatar === undefined) {
      chrome.storage.local.set({ showAvatar: true });
    }

    updatePreview(); // Update preview on page load
  });

  // Disable button by default and set up input listener
  saveButton.disabled = true;
  groupNameInput.addEventListener("input", function () {
    saveButton.disabled = this.value.trim() === "";
  });

  // Save the "Show Avatar" preference when changed
  // event listener for the "Show Avatar" checkbox - it's checking when the avatar display setting changes. 
  // When you uncheck "Show Avatar", it forces the title display back to hover mode if it was set to newline.
  document
    .getElementById("showAvatarCheckbox")
    .addEventListener("change", function () {
      const isChecked = this.checked;

      // If avatar is being disabled, check and reset streamTitleDisplay
      if (!isChecked) {
        chrome.storage.local.get("streamTitleDisplay", function (result) {
          if (result.streamTitleDisplay === "newline") {
            // Reset streamTitleDisplay to hover
            chrome.storage.local.set({ streamTitleDisplay: "hover" }, function () {
              console.log("Stream title display reset to hover");
              // Update the dropdown UI
              const titleDisplaySelect = document.getElementById("streamTitleDisplaySelect");
              if (titleDisplaySelect) {
                titleDisplaySelect.value = "hover";
                const selectedOption = titleDisplaySelect.parentElement.querySelector('.selected-option');
                if (selectedOption) {
                  selectedOption.textContent = "Show channel avatar (default)";
                }
              }
            });
          }
        });
      }

      // Save the avatar preference
      chrome.storage.local.set({ showAvatar: isChecked }, function () {
        chrome.runtime.sendMessage({ action: "oauthComplete" });
        updatePreview(); // Update preview on checkbox change
      });
    });

  displayUserInfo();
  displayGroups();

});
var previewStream = null;

function updatePreview() {
  chrome.storage.local.get(["liveStreams", "streamTitleDisplay", "showStreamTime"], function (data) {
    var liveStreams = data.liveStreams || [];
    var streamTitleDisplay = data.streamTitleDisplay || "off";
    var showStreamTime = data.showStreamTime === "on";
    var previewContainer = document.getElementById("previewContainer");

    if (liveStreams.length > 0) {
      previewStream = liveStreams[Math.floor(Math.random() * liveStreams.length)];
      previewContainer.innerHTML = "";

      var showAvatar = document.getElementById("showAvatarCheckbox").checked;

      var previewDiv = document.createElement("div");
      previewDiv.className = "stream-preview";
      previewDiv.style.position = "relative";

      if (streamTitleDisplay === "newline") {
        previewDiv.style.display = "flex";
        previewDiv.style.alignItems = "flex-start";
      }

      // Handle the newline case with thumbnail
      if (showAvatar && streamTitleDisplay === "newline" && previewStream.thumbnail) {
        var thumbnailWrapper = document.createElement("div");
        thumbnailWrapper.style.position = "relative"; // This is important for absolute positioning of overlay
        thumbnailWrapper.style.flexShrink = "0";
        thumbnailWrapper.style.width = "80px"; // Match thumbnail width
        thumbnailWrapper.style.height = "45px"; // Match thumbnail height
        thumbnailWrapper.style.marginRight = "5px";

        var thumbnailImg = document.createElement("img");
        thumbnailImg.className = "stream-thumbnail";
        thumbnailImg.style.width = "100%";
        thumbnailImg.style.height = "100%";
        thumbnailImg.style.objectFit = "cover";
        thumbnailImg.style.borderRadius = "4px";

        thumbnailImg.src = "css/icon.png";
        thumbnailImg.style.backgroundColor = "#18181b";

        const actualImage = new Image();
        actualImage.onload = () => {
          thumbnailImg.src = previewStream.thumbnail.replace('{width}', '80').replace('{height}', '45');
        };
        actualImage.src = previewStream.thumbnail.replace('{width}', '80').replace('{height}', '45');

        // Add stream time overlay for newline mode
        if (showStreamTime) {
          var timeOverlay = document.createElement("div");
          timeOverlay.className = "stream-time-overlay";
          timeOverlay.textContent = formatStreamTime(previewStream.started_at);

          // Update time every second
          const timeInterval = setInterval(() => {
            if (timeOverlay) {
              timeOverlay.textContent = formatStreamTime(previewStream.started_at);
            }
          }, 1000);

          // Clear interval when element is removed
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.removedNodes.forEach((node) => {
                if (node.contains(timeOverlay)) {
                  clearInterval(timeInterval);
                  observer.disconnect();
                }
              });
            });
          });
          observer.observe(previewContainer, { childList: true, subtree: true });

          thumbnailWrapper.appendChild(timeOverlay);
        }

        thumbnailWrapper.appendChild(thumbnailImg);
        previewDiv.appendChild(thumbnailWrapper);
      }
      // Handle the regular avatar case
      else if (showAvatar && previewStream.avatar) {
        var avatarImg = document.createElement("img");
        avatarImg.src = previewStream.avatar;
        avatarImg.className = "stream-avatar";
        previewDiv.appendChild(avatarImg);
      }

      // Rest of the info wrapper code remains the same...
      const infoWrapper = document.createElement("div");
      if (streamTitleDisplay === "newline") {
        infoWrapper.style.display = "flex";
        infoWrapper.style.flexDirection = "column";
        infoWrapper.style.minWidth = "0";
        infoWrapper.style.flex = "1";
      } else {
        infoWrapper.style.display = "flex";
        infoWrapper.style.flexDirection = "column";
      }

      // Channel name
      var channelNameSpan = document.createElement("span");
      channelNameSpan.textContent = previewStream.channelName;
      channelNameSpan.className = "channel-name";
      channelNameSpan.style.marginTop = streamTitleDisplay === "newline" ? "-4px" : "0";
      channelNameSpan.style.paddingRight = "118px";

      if (showAvatar) {
        channelNameSpan.classList.add("channel-name-with-avatar");
      }

      infoWrapper.appendChild(channelNameSpan);

      // Add title and category for newline mode
      if (streamTitleDisplay === "newline" && previewStream.title) {
        const titleDiv = document.createElement("div");
        titleDiv.style.marginTop = "2px";
        titleDiv.style.fontSize = "12px";
        titleDiv.style.color = "#9CA3AF";
        titleDiv.style.whiteSpace = "nowrap";
        titleDiv.style.overflow = "hidden";
        titleDiv.style.textOverflow = "ellipsis";
        titleDiv.style.maxWidth = "250px";
        titleDiv.textContent = previewStream.title;
        infoWrapper.appendChild(titleDiv);

        const categoryDiv = document.createElement("div");
        categoryDiv.style.fontSize = "11px";
        categoryDiv.style.color = "#9CA3AF";
        categoryDiv.style.marginTop = "2px";
        categoryDiv.style.whiteSpace = "nowrap";
        categoryDiv.style.overflow = "hidden";
        categoryDiv.style.textOverflow = "ellipsis";
        categoryDiv.textContent = previewStream.category;
        infoWrapper.appendChild(categoryDiv);
      } else if (showAvatar && previewStream.category) {
        const categoryDiv = document.createElement("div");
        categoryDiv.style.fontSize = "13px";
        categoryDiv.style.color = "#a0acb6";
        categoryDiv.style.marginTop = "2px";
        categoryDiv.style.whiteSpace = "nowrap";
        categoryDiv.style.overflow = "hidden";
        categoryDiv.style.textOverflow = "ellipsis";
        categoryDiv.style.fontFamily = '"Verdana", sans-serif';
        categoryDiv.style.maxWidth = "150px";
        categoryDiv.textContent = previewStream.category;
        infoWrapper.appendChild(categoryDiv);
      }

      previewDiv.appendChild(infoWrapper);

      // Viewers count and time (for non-newline mode)
      var viewersSpan = document.createElement("span");
      viewersSpan.className = "viewers-count";

      if (showStreamTime && streamTitleDisplay !== "newline") {
        // For non-newline mode, show time with viewers
        const timeText = formatStreamTime(previewStream.started_at);

        // Create separate span for time to style it differently
        const timeSpan = document.createElement("span");
        timeSpan.style.color = "#9CA3AF";
        timeSpan.style.fontSize = "12px";
        timeSpan.textContent = timeText;

        // Add time span and viewers count
        viewersSpan.appendChild(timeSpan);
        viewersSpan.appendChild(document.createTextNode(` ${previewStream.viewers} `));

        // Update time every second
        const timeInterval = setInterval(() => {
          if (timeSpan) {
            timeSpan.textContent = formatStreamTime(previewStream.started_at);
          }
        }, 1000);

        // Clear interval when element is removed
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
              if (node.contains(viewersSpan)) {
                clearInterval(timeInterval);
                observer.disconnect();
              }
            });
          });
        });
        observer.observe(previewContainer, { childList: true, subtree: true });
      } else {
        // Just show viewers count if no time or newline mode
        viewersSpan.textContent = `\u00A0 ${previewStream.viewers} `;
      }

      if (showAvatar) {
        var signalIconSpan = document.createElement("span");
        signalIconSpan.className = "signal-icon";
        var signalIconImg = document.createElement("img");
        signalIconImg.src = "css/signal.svg";
        signalIconImg.style.height = "13px";
        signalIconImg.style.width = "13px";
        signalIconImg.style.marginLeft = "1px";
        signalIconSpan.appendChild(signalIconImg);
        viewersSpan.appendChild(signalIconSpan);
      }

      const viewersWrapper = document.createElement("div");
      viewersWrapper.style.display = "flex";
      viewersWrapper.style.alignItems = "center";

      // Add category inside viewersWrapper
      if (!showAvatar && streamTitleDisplay !== "newline" && previewStream.category) {
        const categoryDiv = document.createElement("div");
        categoryDiv.className = "stream-category";
        categoryDiv.textContent = previewStream.category;
        viewersWrapper.appendChild(categoryDiv);
      }

      if (streamTitleDisplay === "newline") {
        viewersWrapper.style.position = "absolute";
        viewersWrapper.style.right = "8px";
        viewersWrapper.style.marginTop = "2px";
        viewersWrapper.style.flexShrink = "0";
      } else {
        viewersWrapper.style.position = "absolute";
        viewersWrapper.style.right = "8px";
        viewersWrapper.style.top = "50%";
        viewersWrapper.style.transform = "translateY(-50%)";
      }

      viewersWrapper.appendChild(viewersSpan);
      previewDiv.appendChild(viewersWrapper);

      previewContainer.appendChild(previewDiv);
      previewContainer.style.display = "flex";
    } else {
      previewContainer.style.display = "none";
    }
  });
}

// Function to format time as HH:MM:SS
function formatStreamTime(startTime) {
  const now = new Date();
  const start = new Date(startTime);
  const diffInSeconds = Math.floor((now - start) / 1000);

  const hours = Math.floor(diffInSeconds / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);
  const seconds = diffInSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
      if (!userInfoDiv) return;

      if (!result.twitchAccessToken) {
        // Login state code remains the same...
        const loginButton = document.createElement("button");
        loginButton.id = "loginButton";
        loginButton.textContent = "Login with Twitch";
        loginButton.classList.add("login-button");

        loginButton.addEventListener("click", function () {
          chrome.runtime.sendMessage({ action: "startOAuth" });
        });

        userInfoDiv.appendChild(loginButton);

        const infoText = document.createElement("p");
        infoText.innerHTML = "Log in with Twitch to view channels you follow. <br><br> Enjoy real-time updates directly in the extension's popup, making sure you never miss a moment of your favorite streams!";
        infoText.style.marginTop = "10px";
        infoText.style.fontSize = "14px";
        infoText.style.color = "#646464";
        userInfoDiv.appendChild(infoText);
      } else if (result.userDisplayName && result.userAvatar) {
        // Modified logged-in state HTML structure
        userInfoDiv.innerHTML = `
          <div id="userTable">
            <div class="user-row">
              <div class="user-cell">Logged as:</div>
              <div class="user-cell user-avatar-container" role="button" tabindex="0">
                <img src="${result.userAvatar}" alt="User Avatar" class="user-avatar">
                <div class="logout-dropdown">
                  <button id="logoutButton" class="logout-button">
                    <img src="css/logout.png" alt="Logout" class="logout-icon"> Logout
                  </button>
                </div>
              </div>
              <div class="user-cell">${result.userDisplayName}</div>
            </div>
          </div>
        `;

        // Add event listeners immediately after creating the elements
        const avatarContainer = userInfoDiv.querySelector(".user-avatar-container");
        const dropdown = userInfoDiv.querySelector(".logout-dropdown");
        const logoutButton = userInfoDiv.querySelector("#logoutButton");

        // Toggle dropdown on avatar click
        if (avatarContainer && dropdown) {
          avatarContainer.addEventListener("click", (event) => {
            event.stopPropagation();
            dropdown.classList.toggle("show");
          });

          // Add keyboard accessibility
          avatarContainer.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              dropdown.classList.toggle("show");
            }
          });
        }

        // Close dropdown when clicking outside
        document.addEventListener("click", (event) => {
          if (dropdown && dropdown.classList.contains("show") &&
            !avatarContainer.contains(event.target)) {
            dropdown.classList.remove("show");
          }
        });

        // Handle logout
        if (logoutButton) {
          logoutButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            chrome.runtime.sendMessage(
              { action: "disconnectTwitch" },
              function (response) {
                if (response && response.status === "success") {
                  window.location.reload();
                  chrome.storage.local.set({ loginTipShown: false });
                }
              }
            );
          });
        }

        if (!result.loginTipShown) {
          showLoginTip();
          chrome.storage.local.set({ loginTipShown: true });
        }
      } else {
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

// Show accessed count
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

// Filter notifications
document.addEventListener("DOMContentLoaded", function () {
  // Get elements
  const notificationCheckbox = document.getElementById("enableNotificationsCheckbox");
  const filterCheckbox = document.getElementById("enableFilterCheckbox");
  const channelList = document.getElementById("channelList");
  const filterOption = document.getElementById("filterNotificationOption");
  const labelText = document.querySelector("label[for='enableNotificationsCheckbox'] .label-text");
  const tooltipText = document.querySelector("label[for='enableNotificationsCheckbox'] .tooltip-text");

  let checkInterval = null;

  // Function to update notification text based on state
  function updateNotificationText(isEnabled) {
    if (!labelText || !tooltipText) {
      console.error("Label or tooltip elements not found!");
      return;
    }

    if (isEnabled) {
      labelText.textContent = "Live Notifications Enabled";
      tooltipText.textContent = "You will receive notifications when your followed Twitch channels go live. Click to disable.";
      // For debugging
      console.log("Tooltip updated to enabled state:", tooltipText.textContent);
    } else {
      labelText.textContent = "Enable Live Notifications";
      tooltipText.textContent = "Activate to receive notifications when your followed Twitch channels go live.";
      // For debugging
      console.log("Tooltip updated to disabled state:", tooltipText.textContent);
    }
  }

  // Function to start checking for followed list
  function startFollowedListCheck() {
    // Clear any existing interval
    if (checkInterval) {
      clearInterval(checkInterval);
    }

    // If channelList is empty, start checking
    if (!channelList.children.length) {
      checkInterval = setInterval(() => {
        chrome.storage.local.get(["selectedChannels"], function (data) {
          const safeSelectedChannels = Array.isArray(data.selectedChannels) ? data.selectedChannels : [];
          loadChannelList(safeSelectedChannels);
        });
      }, 2000); // Check every 2 seconds
    }
  }

  // Function to stop checking
  function stopFollowedListCheck() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  // Listen for navigation to notifications section
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      startFollowedListCheck();
    } else {
      stopFollowedListCheck();
    }
  });

  // Load initial states
  chrome.storage.local.get(["enableNotifications", "enableFilter", "selectedChannels"], function (data) {
    const isNotificationsEnabled = data.enableNotifications || false;
    const isFilterEnabled = data.enableFilter || false;

    notificationCheckbox.checked = isNotificationsEnabled;
    filterCheckbox.checked = isFilterEnabled;

    // Add a small delay to ensure DOM is fully loaded
    setTimeout(() => {
      updateNotificationText(isNotificationsEnabled);
    }, 0);

    updateFilterControl(isNotificationsEnabled);

    const safeSelectedChannels = Array.isArray(data.selectedChannels) ? data.selectedChannels : [];
    loadChannelList(safeSelectedChannels);
    updateChannelListState(isNotificationsEnabled && isFilterEnabled);
  });


  // Start the check on initial load if needed
  startFollowedListCheck();

  // Handle notification checkbox changes
  notificationCheckbox.addEventListener("change", function () {
    const isChecked = this.checked;
    chrome.storage.local.set({ enableNotifications: isChecked }, function () {
      console.log("Enable Notifications preference updated:", isChecked);
    });

    updateNotificationText(isChecked);
    updateFilterControl(isChecked);
    updateChannelListState(isChecked && filterCheckbox.checked);
  });

  // Handle filter checkbox changes
  filterCheckbox.addEventListener("click", function (e) {
    // Prevent toggling if notifications are disabled
    if (!notificationCheckbox.checked) {
      e.preventDefault();
      return; // Exit early
    }
  });

  filterCheckbox.addEventListener("change", function () {
    if (!notificationCheckbox.checked) {
      this.checked = false;
      return;
    }

    const isChecked = this.checked;
    chrome.storage.local.set({ enableFilter: isChecked }, function () {
      console.log("Filter preference updated:", isChecked);
    });

    updateChannelListState(isChecked && notificationCheckbox.checked);

    if (!isChecked) {
      chrome.storage.local.set({ selectedChannels: [] });
      const checkboxes = channelList.querySelectorAll(".channel-checkbox");
      checkboxes.forEach(checkbox => checkbox.checked = false);
    }
  });

  function updateFilterControl(notificationsEnabled) {
    const filterOption = document.getElementById("filterNotificationOption");

    if (notificationsEnabled) {
      filterOption.classList.remove("disabled");
      filterCheckbox.disabled = false;
    } else {
      filterOption.classList.add("disabled");
      filterCheckbox.disabled = true;
    }
  }

  function updateChannelListState(enabled) {
    channelList.style.opacity = enabled ? "1" : "0.5";
    const containers = channelList.querySelectorAll(".channel-checkbox-container");

    containers.forEach(container => {
      const checkbox = container.querySelector(".channel-checkbox");
      checkbox.disabled = !enabled;
      checkbox.style.cursor = enabled ? "pointer" : "not-allowed";

      if (!enabled) {
        container.classList.add("disabled");
      } else {
        container.classList.remove("disabled");
      }
    });
  }

  function loadChannelList(selectedChannels = []) {
    if (!channelList) {
      console.error("Channel list element not found!");
      return;
    }

    getFollowedList()
      .then(followedList => {
        if (!followedList || !Array.isArray(followedList) || followedList.length === 0) {
          return;
        }

        // If we successfully got the list, stop checking
        stopFollowedListCheck();

        // Clear the list before loading new content
        channelList.innerHTML = "";

        followedList.forEach(channel => {
          if (!channel || typeof channel.broadcaster_name !== 'string') {
            return;
          }

          const channelDiv = document.createElement("div");
          channelDiv.className = "channel-checkbox-container";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = `channel-${channel.broadcaster_name}`;
          checkbox.className = "channel-checkbox";
          checkbox.checked = selectedChannels.includes(channel.broadcaster_name);

          const label = document.createElement("label");
          label.htmlFor = `channel-${channel.broadcaster_name}`;
          label.textContent = channel.broadcaster_name;

          checkbox.addEventListener("change", function () {
            if (!checkbox.disabled) {
              updateSelectedChannels();
            }
          });

          channelDiv.appendChild(checkbox);
          channelDiv.appendChild(label);
          channelList.appendChild(channelDiv);
        });

        updateChannelListState(notificationCheckbox.checked && filterCheckbox.checked);
      })
      .catch(error => {
        if (error && error.message && !error.message.includes("No followed list")) {
          console.error("Unexpected error loading followed list:", error);
        }
      });
  }

  function updateSelectedChannels() {
    const checkboxes = channelList.querySelectorAll(".channel-checkbox");
    const selectedChannels = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.id.replace("channel-", ""));

    chrome.storage.local.set({ selectedChannels }, function () {
      console.log("Selected channels updated:", selectedChannels);
    });
  }

});

// Dropdowns - Stream grouping
document.addEventListener("DOMContentLoaded", function () {
  // Theme handling function
  function setTheme(isDarkMode) {
    try {
      if (isDarkMode) {
        document.body.classList.add("dark-mode");
        document.body.classList.remove("light-mode");
      } else {
        document.body.classList.remove("dark-mode");
        document.body.classList.add("light-mode");
      }
      console.log(`Theme set to: ${isDarkMode ? 'dark' : 'light'} mode`);
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  }

  // Function to get clean text without the dot
  function getCleanOptionText(optionElement) {
    // Get all text nodes, filter out the dot span
    const textNodes = Array.from(optionElement.childNodes)
      .filter(node => {
        // Exclude the option-dot span
        return !(node.nodeType === 1 && node.classList.contains('option-dot'));
      })
      .map(node => node.textContent.trim())
      .join('')
      .trim();

    return textNodes;
  }

  // Function to handle dropdown disabled state
  function updateTitleDisplayDropdownState(isAvatarEnabled) {
    const titleDisplayContainer = document.querySelector('.title-display-container');
    const titleDisplayHeader = titleDisplayContainer.querySelector('.custom-select-header');
    const titleDisplayOptions = titleDisplayContainer.querySelector('.custom-select-options');

    if (isAvatarEnabled) {
      titleDisplayContainer.classList.remove('disabled');
      titleDisplayHeader.removeAttribute('disabled');
      titleDisplayHeader.style.pointerEvents = 'auto';
      titleDisplayHeader.style.opacity = '1';
    } else {
      titleDisplayContainer.classList.add('disabled');
      titleDisplayHeader.setAttribute('disabled', 'true');
      titleDisplayHeader.style.pointerEvents = 'none';
      titleDisplayHeader.style.opacity = '0.5';
      titleDisplayContainer.classList.remove('open'); // Close dropdown if open
    }
  }

  // Generic dropdown initialization function
  function initializeDropdown(selectContainer, selectId, storageKey) {
    try {
      const header = selectContainer.querySelector('.custom-select-header');
      const selectedText = header.querySelector('.selected-option');
      const options = selectContainer.querySelectorAll('.custom-option');
      const originalSelect = document.getElementById(selectId);

      if (!header || !selectedText || !options.length || !originalSelect) {
        throw new Error('Required dropdown elements not found');
      }

      // Load saved setting from storage
      chrome.storage.local.get(storageKey, function (data) {
        try {
          const preference = data[storageKey] || (storageKey === "darkMode" ? "dark" : "off");

          // Update original select value
          originalSelect.value = preference;

          // Find the matching option based on the current value
          const matchingOption = Array.from(options).find(
            option => option.dataset.value === preference
          );

          if (matchingOption) {
            // Set header text without the dot
            selectedText.textContent = getCleanOptionText(matchingOption);
            options.forEach(opt => opt.classList.remove('selected'));
            matchingOption.classList.add('selected');
          }

          // If the storageKey is "darkMode", apply the theme
          if (storageKey === "darkMode") {
            setTheme(preference === "dark");
          }
        } catch (error) {
          console.error('Error in storage callback:', error);
        }
      });

      // Toggle dropdown visibility on header click
      header.addEventListener('click', (e) => {
        document.querySelectorAll('.custom-select-container').forEach(container => {
          if (container !== selectContainer) {
            container.classList.remove('open');
          }
        });

        selectContainer.classList.toggle('open');

        if (selectContainer.classList.contains('open')) {
          const optionsElement = selectContainer.querySelector('.custom-select-options');
          const headerElement = selectContainer.querySelector('.custom-select-header');
          const containerRect = selectContainer.getBoundingClientRect();
          const viewportHeight = window.innerHeight;

          // Reset any existing positioning
          optionsElement.style.top = '';
          optionsElement.style.bottom = '';

          // Check if dropdown would overflow viewport
          const dropdownHeight = optionsElement.offsetHeight;
          const spaceBelow = viewportHeight - containerRect.bottom;

          if (spaceBelow < dropdownHeight + 10) {
            // Position above the header, directly adjacent
            optionsElement.style.bottom = `${headerElement.offsetHeight - 4}px`;
            optionsElement.style.top = 'auto';
          } else {
            // Position below the header
            optionsElement.style.top = '100%';
          }
        }

        e.stopPropagation();
      });

      // Handle option selection
      options.forEach(option => {
        option.addEventListener('click', () => {
          try {
            const cleanText = getCleanOptionText(option);
            const value = option.dataset.value;

            // Update custom dropdown display with clean text
            selectedText.textContent = cleanText;
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectContainer.classList.remove('open');

            // Update original select value
            originalSelect.value = value;

            // If the storageKey is "darkMode", apply the theme
            if (storageKey === "darkMode") {
              setTheme(value === "dark");
            }

            // Create updates object for storage
            let updates = { [storageKey]: value };

            // If this is the stream title display being set to newline,
            // automatically enable stream time
            if (storageKey === "streamTitleDisplay" && value === "newline") {
              updates.showStreamTime = "on";  // Set the correct value to match the select options

              // Update stream time dropdown UI
              const streamTimeContainer = document.querySelector('.custom-select-container:has(#showStreamTimeSelect)');
              if (streamTimeContainer) {
                const streamTimeHeader = streamTimeContainer.querySelector('.selected-option');
                const streamTimeOptions = streamTimeContainer.querySelectorAll('.custom-option');

                if (streamTimeHeader) {
                  streamTimeHeader.textContent = "Show stream time";
                }

                streamTimeOptions.forEach(opt => {
                  opt.classList.remove('selected');
                  if (opt.dataset.value === 'on') {
                    opt.classList.add('selected');
                  }
                });

                // Update the original select for stream time
                const streamTimeSelect = document.getElementById('showStreamTimeSelect');
                if (streamTimeSelect) {
                  streamTimeSelect.value = "on";  // Make sure to use the string "on"
                }

                // Trigger the change event on the original select
                streamTimeSelect.dispatchEvent(new Event('change'));
              }
            }

            // Save to storage
            chrome.storage.local.set(updates, function () {
              chrome.runtime.sendMessage({ action: "oauthComplete" });
              console.log(`Settings updated:`, updates);
              if (typeof updatePreview === 'function') {
                updatePreview();
              }
            });
          } catch (error) {
            console.error('Error handling option selection:', error);
          }
        });
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        const isClickInside = selectContainer.contains(e.target);
        const isHeaderClick = header === e.target || header.contains(e.target);

        if (!isClickInside && !isHeaderClick) {
          selectContainer.classList.remove('open');
        }
      });
    } catch (error) {
      console.error('Error initializing dropdown:', error);
    }
  }

  // Initialize all dropdowns
  try {
    // Get the avatar checkbox
    const avatarCheckbox = document.getElementById('showAvatarCheckbox');

    // Initialize the dropdown state based on avatar checkbox
    chrome.storage.local.get('showAvatar', function (data) {
      const isAvatarEnabled = data.showAvatar !== false;
      updateTitleDisplayDropdownState(isAvatarEnabled);
    });

    // Add event listener for avatar checkbox changes
    if (avatarCheckbox) {
      avatarCheckbox.addEventListener('change', function (e) {
        updateTitleDisplayDropdownState(e.target.checked);
      });
    }

    document.querySelectorAll('.custom-select-container').forEach(container => {
      const selectElement = container.querySelector('select');
      if (selectElement) {
        const selectId = selectElement.id;
        const storageKey = {
          "showStreamTimeSelect": "showStreamTime",
          "streamGroupingSelect": "streamGrouping",
          "streamTitleDisplaySelect": "streamTitleDisplay",
          "themeSelect": "darkMode",
        }[selectId];

        if (storageKey) {
          initializeDropdown(container, selectId, storageKey);
        }
      }
    });
  } catch (error) {
    console.error('Error in dropdown initialization:', error);
  }

  document.getElementById("filterNotificationOption").addEventListener("click", function (e) {
    // Get checkbox fresh each click to avoid reference errors
    const notificationCheckbox = document.getElementById('enableNotificationsCheckbox');

    if (notificationCheckbox && !notificationCheckbox.checked) {
      e.preventDefault();
      e.stopPropagation();

      // Add shake class to whole container (more visible)
      this.classList.add('shake-it');

      // Remove after animation completes
      setTimeout(() => {
        this.classList.remove('shake-it');
      }, 400);

      // Show tooltip during interaction
      this.classList.add('force-tooltip');
      setTimeout(() => {
        this.classList.remove('force-tooltip');
      }, 1000);
    }
  });
});

// Menu navigation functionality and tooltip
document.addEventListener('DOMContentLoaded', function () {
  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.querySelectorAll('.settings-section');

  // Get all elements with tooltips
  const labelsWithTooltips = document.querySelectorAll('.styled-label');

  labelsWithTooltips.forEach(label => {
    const tooltip = label.querySelector('.tooltip-text');

    if (tooltip) {
      label.addEventListener('mouseenter', function () {
        // Reset to default (top) first
        tooltip.classList.remove('position-bottom');

        // Get positions
        const labelRect = label.getBoundingClientRect();
        const tooltipHeight = tooltip.offsetHeight;

        // If not enough space above, move to bottom
        if (labelRect.top < tooltipHeight) {
          tooltip.classList.add('position-bottom');
        }
      });
    }
  });

  // navigation functionality
  menuItems.forEach(item => {
    item.addEventListener('click', function () {
      // Remove active class from all items
      menuItems.forEach(i => i.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      // Add active class to clicked item
      this.classList.add('active');

      // Show corresponding section
      const sectionId = this.getAttribute('data-section') + '-section';
      document.getElementById(sectionId).classList.add('active');
    });
  });
});
