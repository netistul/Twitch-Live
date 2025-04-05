// favorite-groups-settings.js
//
// --- Core Functionality: Favorite Groups ---

/**
 * Fetches favorite groups from storage and displays them in the UI.
 * Handles empty state and sets up group item interactions.
 */
function displayGroups() {
    chrome.storage.local.get(
        ["favoriteGroups", "twitchAccessToken", "followedList"],
        function (data) {
            const groups = data.favoriteGroups || [];
            const groupListContainer = document.getElementById("groupListContainer");
            const favoriteSection = document.getElementById("favorites-section");
            const isLoggedIn = data.twitchAccessToken != null;
            const hasFollowers = data.followedList && data.followedList.length > 0;

            // Clear previous content
            groupListContainer.innerHTML = "";

            // Remove any existing demo container
            const existingDemo = document.querySelector(".favorite-demo-container");
            if (existingDemo) {
                existingDemo.remove();
            }

            if (groups.length === 0) {
                // Empty state
                groupListContainer.innerHTML = `<div class="empty-groups-container">
                    <p style="font-size: 16px; text-align: center;">
                        <img src="../../css/settings/nogroup.gif" style="display: block; margin: 0 auto; max-width: 100%;">
                        <strong>No Favorite Groups Created Yet</strong><br><br>
                        This is a list that will help you filter your favorite live streams from the popup into new category groups.
                        <br><br>
                        You can create a group and add any Twitch channel to it, organizing your streams.
                    </p>
                </div>`;
            } else {
                // Create and populate the group list
                const groupList = document.createElement("ul");
                groupList.id = "groupList";

                groups.forEach(function (group, index) {
                    const groupItem = createGroupListItem(group, index, isLoggedIn, hasFollowers);
                    groupList.appendChild(groupItem);
                });

                groupListContainer.appendChild(groupList);
            }

            // Show the quick tip demo container if fewer than 3 groups (including 0)
            if (groups.length < 3) {
                const addButton = document.getElementById("addFavoriteGroupButton");

                // Create demo container with popup icon style
                const demoContainer = document.createElement("div");
                demoContainer.className = "favorite-demo-container";
                demoContainer.innerHTML = `
                    <p class="demo-title">💡 You can also do this from the popup by right-clicking on any stream channel and selecting an existing group or creating a new one.</p>
                    <div class="image-container">
                        <img src="../../css/add-fav.png" class="add-fav-demo" alt="How to add favorites">
                        <div class="popup-icon">
                            <img src="../../css/icon.png" class="demo-icon" alt="Extension icon">
                        </div>
                    </div>
                `;

                // Insert the demo container after the add button
                favoriteSection.insertBefore(demoContainer, addButton.nextSibling);
            }
        }
    );
}

/**
* Creates a single list item element for a favorite group.
* @param {object} group - The group data ({ name, streamers }).
* @param {number} index - The index of the group in the array.
* @param {boolean} isLoggedIn - Whether the user is logged in.
* @param {boolean} hasFollowers - Whether the user has followed channels.
* @returns {HTMLElement} The created list item element.
*/
function createGroupListItem(group, index, isLoggedIn, hasFollowers) {
    const groupItem = document.createElement("li");
    groupItem.classList.add("group-item");

    // Group Name Container
    const groupNameContainer = document.createElement("div");
    groupNameContainer.className = "group-name-container";
    const groupNameSpan = document.createElement("span");
    groupNameSpan.textContent = group.name;
    groupNameSpan.className = "group-name";
    groupNameSpan.style.cursor = "pointer";

    const editGroupBtn = document.createElement("button");
    editGroupBtn.className = "edit-group-btn edit-group-btn-settings"; // Combine classes
    editGroupBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

    const enterEditMode = () => {
        groupNameSpan.contentEditable = true;
        groupNameSpan.classList.add("editing");
        groupNameSpan.focus();

        // Select text for easy editing
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(groupNameSpan);
        range.collapse(false); // Place cursor at the end
        selection.removeAllRanges();
        selection.addRange(range);

        const originalName = groupNameSpan.textContent;

        const saveEdit = () => {
            groupNameSpan.contentEditable = false;
            groupNameSpan.classList.remove("editing");
            groupNameSpan.onkeydown = null; // Clean up listener
            groupNameSpan.onblur = null; // Clean up listener

            const newName = groupNameSpan.textContent.trim();
            if (newName && newName !== originalName) {
                updateGroupName(index, newName);
            } else if (!newName) {
                // Revert if empty
                groupNameSpan.textContent = originalName;
            }
        };

        groupNameSpan.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent adding newline
                saveEdit();
                groupNameSpan.blur(); // Trigger blur which also saves
            } else if (e.key === 'Escape') {
                groupNameSpan.textContent = originalName; // Revert
                saveEdit(); // Save (reverted value) and remove editing state
                groupNameSpan.blur();
            }
        };

        // Save on losing focus
        groupNameSpan.onblur = saveEdit;
    };

    groupNameSpan.onclick = enterEditMode;
    editGroupBtn.onclick = enterEditMode;

    groupNameContainer.appendChild(groupNameSpan);
    groupNameContainer.appendChild(editGroupBtn);
    groupItem.appendChild(groupNameContainer);

    // Streamers List
    const streamersList = document.createElement("ul");
    streamersList.classList.add("streamers-list");
    streamersList.style.listStyleType = "none";
    streamersList.style.padding = "0";

    group.streamers.forEach(function (streamer, streamerIndex) {
        const streamerItem = createStreamerListItem(streamer, index, streamerIndex);
        streamersList.appendChild(streamerItem);
    });
    groupItem.appendChild(streamersList);

    // Button Container
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("button-container");

    const addStreamerBtn = document.createElement("button");
    addStreamerBtn.className = "add-streamer-btn";
    addStreamerBtn.textContent = "Add twitch channel";
    if (isLoggedIn && hasFollowers) {
        addStreamerBtn.onclick = () => showAddStreamerDropdown(index);
    } else {
        addStreamerBtn.onclick = () => {
            alert("Log in with Twitch and follow channels to add them to groups.");
        };
        addStreamerBtn.disabled = true; // Optionally disable if unusable
        addStreamerBtn.title = "Log in and follow channels first";
    }
    buttonContainer.appendChild(addStreamerBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-group-btn";
    deleteBtn.textContent = "Delete list";
    deleteBtn.onclick = () => deleteGroup(index); // No need to redraw here, deleteGroup handles it
    buttonContainer.appendChild(deleteBtn);

    groupItem.appendChild(buttonContainer);
    return groupItem;
}

/**
* Creates a list item for a single streamer within a group.
* @param {string} streamer - The streamer's name.
* @param {number} groupIndex - The index of the parent group.
* @param {number} streamerIndex - The index of the streamer within the group.
* @returns {HTMLElement} The created list item element.
*/
function createStreamerListItem(streamer, groupIndex, streamerIndex) {
    const streamerItem = document.createElement("li");
    streamerItem.style.display = "flex";
    streamerItem.style.justifyContent = "space-between";
    streamerItem.style.alignItems = "center";
    streamerItem.style.fontSize = "70%";

    const twitchIcon = document.createElement("img");
    twitchIcon.src = "../../css/twitch.png";
    twitchIcon.alt = "Twitch";
    twitchIcon.style.width = "20px";
    twitchIcon.style.marginRight = "3px";
    streamerItem.appendChild(twitchIcon);

    const streamerNameSpan = document.createElement("span");
    streamerNameSpan.textContent = streamer;
    streamerNameSpan.style.flexGrow = "1";
    streamerItem.appendChild(streamerNameSpan);

    const deleteStreamerBtn = document.createElement("button");
    deleteStreamerBtn.textContent = "❌";
    deleteStreamerBtn.style.cssText = `
        width: 24px; background: transparent; border: none; cursor: pointer;
        padding: 2px; font-size: 12px; opacity: 0.6; transition: all 0.2s ease;
    `; // Use cssText for brevity

    deleteStreamerBtn.onmouseover = function () { this.style.opacity = "1"; this.style.transform = "scale(1.2)"; };
    deleteStreamerBtn.onmouseout = function () { this.style.opacity = "0.6"; this.style.transform = "scale(1)"; };
    deleteStreamerBtn.onclick = () => deleteStreamer(groupIndex, streamerIndex);

    streamerItem.appendChild(deleteStreamerBtn);
    return streamerItem;
}

/**
* Updates the name of a group in storage.
* @param {number} index - The index of the group to update.
* @param {string} newName - The new name for the group.
*/
function updateGroupName(index, newName) {
    chrome.storage.local.get("favoriteGroups", function (data) {
        const groups = data.favoriteGroups || [];
        if (groups[index]) {
            groups[index].name = newName;
            chrome.storage.local.set({ favoriteGroups: groups }, function () {
                console.log("Group name updated:", newName);
                // Optionally send a message if other parts of the extension need to know
                // chrome.runtime.sendMessage({ action: "groupUpdated" });
                // No need to call displayGroups() here, UI updated directly.
            });
        } else {
            console.error("Attempted to update non-existent group at index:", index);
        }
    });
}


/**
* Deletes a streamer from a specific group in storage and redraws the groups.
* @param {number} groupIndex - The index of the group.
* @param {number} streamerIndex - The index of the streamer to delete.
*/
function deleteStreamer(groupIndex, streamerIndex) {
    chrome.storage.local.get("favoriteGroups", function (data) {
        const groups = data.favoriteGroups || [];
        if (groups[groupIndex] && groups[groupIndex].streamers && groups[groupIndex].streamers[streamerIndex] !== undefined) {
            const deletedStreamer = groups[groupIndex].streamers[streamerIndex]; // Get name for logging/message
            groups[groupIndex].streamers.splice(streamerIndex, 1);

            chrome.storage.local.set({ favoriteGroups: groups }, function () {
                console.log(`Streamer '${deletedStreamer}' deleted from group '${groups[groupIndex]?.name || groupIndex}'`);
                chrome.runtime.sendMessage({ action: "settingsChanged" }); // General message
                displayGroups(); // Redraw the list
            });
        } else {
            console.error(`Error deleting streamer: Invalid indices [${groupIndex}, ${streamerIndex}] or streamers array missing.`);
        }
    });
}

/**
* Deletes an entire group from storage and redraws the groups.
* @param {number} index - The index of the group to delete.
*/
function deleteGroup(index) {
    chrome.storage.local.get("favoriteGroups", function (data) {
        const groups = data.favoriteGroups || [];
        if (index >= 0 && index < groups.length) {
            const deletedGroupName = groups[index].name; // Get name for logging
            groups.splice(index, 1);

            chrome.storage.local.set({ favoriteGroups: groups }, function () {
                console.log(`Group '${deletedGroupName}' deleted`);
                chrome.runtime.sendMessage({ action: "settingsChanged" }); // General message
                displayGroups(); // Redraw the list
            });
        } else {
            console.error(`Error deleting group: Invalid index ${index}`);
        }
    });
}


/**
* Shows a dropdown/modal to add streamers from the followed list to a specific group.
* @param {number} groupIndex - The index of the target group.
*/
async function showAddStreamerDropdown(groupIndex) {
    clearAllNotifications(); // Clear any lingering temp notifications

    try {
        const followedList = await getFollowedList();
        if (followedList.length === 0) {
            alert("No followed channels found. Follow some channels on Twitch first!");
            return;
        }

        chrome.storage.local.get("favoriteGroups", (data) => {
            if (chrome.runtime.lastError) {
                console.error("Storage error:", chrome.runtime.lastError);
                alert("Could not load group data.");
                return;
            }

            const groups = data.favoriteGroups || [];
            const targetGroup = groups[groupIndex];

            if (!targetGroup) {
                console.error("Target group not found for index:", groupIndex);
                alert("Error: Could not find the selected group.");
                return;
            }

            // Remove any existing dropdown first
            document.querySelectorAll(".dropdown-menu, #dropdownOverlay").forEach(el => el.remove());

            // Create Overlay
            const overlay = document.createElement("div");
            overlay.id = "dropdownOverlay";
            document.body.appendChild(overlay);

            // Create Dropdown Menu
            const dropdownMenu = document.createElement("div");
            dropdownMenu.className = "dropdown-menu";
            document.body.appendChild(dropdownMenu);

            // Header
            const dropdownHeader = document.createElement("div");
            dropdownHeader.className = "dropdown-header";
            dropdownMenu.appendChild(dropdownHeader);

            const dropdownTitle = document.createElement("h3");
            dropdownTitle.className = "dropdown-title";
            dropdownTitle.innerHTML = `
                <span class="list-title">Add to list:</span>
                <span class="list-name">${targetGroup.name || 'Unknown'}</span>
            `;
            dropdownHeader.appendChild(dropdownTitle);

            // Content Area
            const dropdownContent = document.createElement("div");
            dropdownContent.className = "dropdown-content";
            dropdownMenu.appendChild(dropdownContent);

            // Search Input
            const searchContainer = document.createElement("div");
            searchContainer.className = "dropdown-search-container";
            const searchInput = document.createElement("input");
            searchInput.type = "text";
            searchInput.className = "dropdown-search";
            searchInput.placeholder = `Search streamer... (${followedList.length})`;
            searchContainer.appendChild(searchInput);
            dropdownContent.appendChild(searchContainer);

            // Items Container
            const itemsContainer = document.createElement("div");
            itemsContainer.className = "dropdown-items-container";
            itemsContainer.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))"; // Or load from CSS
            dropdownContent.appendChild(itemsContainer);

            // --- Populate Streamer List ---
            populateStreamerList(itemsContainer, followedList, targetGroup, groupIndex);

            // --- Search Functionality ---
            searchInput.addEventListener("input", (e) => {
                filterStreamerList(itemsContainer, e.target.value.toLowerCase());
            });

            // --- Display and Close ---
            dropdownMenu.style.display = "block"; // Or manage via CSS classes
            overlay.style.display = "block";

            overlay.addEventListener("click", () => {
                closeAddStreamerDropdown(dropdownMenu, overlay);
            });
        }); // End chrome.storage.local.get callback

    } catch (error) {
        console.error("Error showing streamer dropdown:", error);
        alert("Could not load followed channels. Please try again later.");
    }
}

/**
* Populates the dropdown list with followed streamers, grouped by letter.
* @param {HTMLElement} container - The element to add items to.
* @param {Array} followedList - List of followed channel objects.
* @param {object} targetGroup - The group object being added to.
* @param {number} groupIndex - The index of the target group.
*/
function populateStreamerList(container, followedList, targetGroup, groupIndex) {
    container.innerHTML = ''; // Clear existing items
    const currentStreamersInGroup = new Set(targetGroup.streamers || []);

    // Group by first letter
    const groupedStreamers = followedList.reduce((acc, channel) => {
        if (channel && channel.broadcaster_name) {
            const firstLetter = channel.broadcaster_name.charAt(0).toUpperCase();
            if (!acc[firstLetter]) acc[firstLetter] = [];
            acc[firstLetter].push(channel);
        }
        return acc;
    }, {});

    // Sort letters and streamers within letters
    const sortedLetters = Object.keys(groupedStreamers).sort();

    sortedLetters.forEach((letter, letterIndex) => {
        const letterHeader = document.createElement("div");
        letterHeader.className = "dropdown-letter-header" + (letterIndex === 0 ? " first-letter-header" : "");
        letterHeader.textContent = letter;
        container.appendChild(letterHeader);

        groupedStreamers[letter].sort((a, b) =>
            a.broadcaster_name.localeCompare(b.broadcaster_name)
        );

        groupedStreamers[letter].forEach(channel => {
            const isAdded = currentStreamersInGroup.has(channel.broadcaster_name);
            const item = createDropdownStreamerItem(channel, isAdded, groupIndex, targetGroup.name);
            container.appendChild(item);
        });
    });
}

/**
* Creates a single streamer item element for the add streamer dropdown.
* @param {object} channel - The channel data object.
* @param {boolean} isAdded - Whether the channel is already in the target group.
* @param {number} groupIndex - The index of the target group.
* @param {string} groupName - The name of the target group.
* @returns {HTMLElement} The created item element.
*/
function createDropdownStreamerItem(channel, isAdded, groupIndex, groupName) {
    const item = document.createElement("div");
    item.className = `dropdown-item ${isAdded ? "added" : ""}`;
    item.style.cursor = "pointer";
    item.dataset.channelName = channel.broadcaster_name.toLowerCase(); // For filtering

    const twitchLogo = document.createElement("img");
    twitchLogo.src = "../../css/twitch.png";
    twitchLogo.className = "dropdown-twitch-logo";

    const channelNameSpan = document.createElement("span");
    channelNameSpan.className = "dropdown-channel-name";
    channelNameSpan.textContent = channel.broadcaster_name;

    const heart = document.createElement("div");
    heart.className = `dropdown-heart ${isAdded ? "added" : ""}`;

    const handleToggle = (e) => {
        // Allow clicking anywhere on item, but prevent if heart itself is clicked (handled below)
        if (heart.contains(e.target)) return;
        e.stopPropagation(); // Prevent overlay click if click is on item but not heart
        toggleChannelInGroup(channel, groupIndex, groupName, heart, item);
    };

    item.addEventListener("click", handleToggle);

    // Separate listener for heart allows specific targeting if needed
    heart.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent item click handler and overlay click
        toggleChannelInGroup(channel, groupIndex, groupName, heart, item);
    });


    item.append(twitchLogo, channelNameSpan, heart);
    return item;
}

/**
* Toggles a channel's presence in a favorite group.
* @param {object} channel - The channel object.
* @param {number} groupIndex - Index of the group.
* @param {string} groupName - Name of the group.
* @param {HTMLElement} heartElement - The heart icon element.
* @param {HTMLElement} itemElement - The dropdown item element.
*/
function toggleChannelInGroup(channel, groupIndex, groupName, heartElement, itemElement) {
    chrome.storage.local.get("favoriteGroups", (data) => {
        if (chrome.runtime.lastError) {
            console.error("Storage error:", chrome.runtime.lastError);
            return;
        }
        const groups = data.favoriteGroups || [];
        if (!groups[groupIndex]) {
            console.error("Group not found at index:", groupIndex);
            return;
        }

        const streamers = groups[groupIndex].streamers || [];
        const channelName = channel.broadcaster_name;
        const streamerIndex = streamers.indexOf(channelName);
        const wasAdded = streamerIndex !== -1;

        if (wasAdded) {
            // Remove
            groups[groupIndex].streamers.splice(streamerIndex, 1);
            heartElement.classList.remove("added");
            itemElement.classList.remove("added");
        } else {
            // Add
            groups[groupIndex].streamers.push(channelName);
            // Optional: Sort the list after adding
            // groups[groupIndex].streamers.sort((a, b) => a.localeCompare(b));
            heartElement.classList.add("added");
            itemElement.classList.add("added");
        }

        chrome.storage.local.set({ favoriteGroups: groups }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving updated groups:", chrome.runtime.lastError);
                // Optionally revert UI changes if save fails
                if (wasAdded) { // Re-add if removal failed
                    heartElement.classList.add("added"); itemElement.classList.add("added");
                } else { // Re-remove if add failed
                    heartElement.classList.remove("added"); itemElement.classList.remove("added");
                }
                return;
            }
            // Successfully saved
            displayGroups(); // Update the main list display
            showTemporaryNotification(
                wasAdded ? 'removed from' : 'added to',
                wasAdded ? 'removed' : 'added',
                channelName,
                groupName
            );
            chrome.runtime.sendMessage({ action: "settingsChanged" }); // Notify background/popup
        });
    });
}

/**
* Filters the streamer list in the add streamer dropdown based on search input.
* @param {HTMLElement} container - The items container element.
* @param {string} searchValue - The search term (lowercase).
*/
function filterStreamerList(container, searchValue) {
    let hasVisibleItems = false;
    const items = container.querySelectorAll(".dropdown-item");
    const headers = container.querySelectorAll(".dropdown-letter-header");

    headers.forEach(header => header.style.display = 'none'); // Hide all headers initially

    items.forEach(item => {
        const name = item.dataset.channelName; // Use stored lowercase name
        const isMatch = name.includes(searchValue);
        item.style.display = isMatch ? "flex" : "none";
        if (isMatch) {
            hasVisibleItems = true;
            // Find the preceding header and show it
            let prev = item.previousElementSibling;
            while (prev && !prev.classList.contains("dropdown-letter-header")) {
                prev = prev.previousElementSibling;
            }
            if (prev && prev.classList.contains("dropdown-letter-header")) {
                prev.style.display = "block";
            }
        }
    });

    // Show all headers and items if search is empty
    if (!searchValue) {
        headers.forEach(header => header.style.display = 'block');
        items.forEach(item => item.style.display = 'flex');
        hasVisibleItems = true; // Ensure no "not found" message when empty
    }

    // Handle "No results" message (optional)
    let noResultsMessage = container.querySelector(".no-results-message");
    if (!hasVisibleItems && searchValue) {
        if (!noResultsMessage) {
            noResultsMessage = document.createElement("div");
            noResultsMessage.className = "no-results-message";
            noResultsMessage.style.textAlign = "center";
            noResultsMessage.style.padding = "10px";
            noResultsMessage.style.gridColumn = "1 / -1"; // Span across columns
            container.appendChild(noResultsMessage);
        }
        noResultsMessage.textContent = `No followed channel matching "${searchValue}" found.`;
        noResultsMessage.style.display = "block";
    } else if (noResultsMessage) {
        noResultsMessage.style.display = "none";
    }
}


/**
* Closes the add streamer dropdown and overlay.
* @param {HTMLElement} dropdownMenu
* @param {HTMLElement} overlay
*/
function closeAddStreamerDropdown(dropdownMenu, overlay) {
    clearAllNotifications(); // Clear any temp notifications shown during add/remove
    if (dropdownMenu) dropdownMenu.remove();
    if (overlay) overlay.remove();
}


/** Sets up the "Add Favorite Group" modal interactions */
function setupAddGroupModal() {
    const modal = document.getElementById("myModal");
    const openBtn = document.getElementById("addFavoriteGroupButton");
    const saveButton = document.getElementById("saveGroup");
    const cancelButton = document.querySelector('#myModal .btn-cancel'); // More specific selector
    const groupNameInput = document.getElementById("groupName");

    if (!modal || !openBtn || !saveButton || !cancelButton || !groupNameInput) {
        console.error("Add Group Modal elements missing!");
        return;
    }

    const openModal = () => {
        groupNameInput.value = ''; // Clear input on open
        saveButton.disabled = true; // Ensure save is disabled initially
        modal.style.display = "flex";
        groupNameInput.focus(); // Focus input when opening
    };

    const closeModal = () => {
        modal.style.display = "none";
    };

    openBtn.onclick = openModal;
    cancelButton.onclick = closeModal;

    // Close modal if clicking outside the content
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Enable/disable save button based on input
    groupNameInput.addEventListener("input", function () {
        saveButton.disabled = this.value.trim() === "";
    });

    // Handle Enter key in input field to save
    groupNameInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !saveButton.disabled) {
            event.preventDefault(); // Prevent form submission if it were a form
            saveGroup();
        } else if (event.key === 'Escape') {
            closeModal();
        }
    });


    // Save group functionality
    const saveGroup = () => {
        const groupName = groupNameInput.value.trim();
        if (!groupName) return; // Should be blocked by disabled button, but safety check

        chrome.storage.local.get("favoriteGroups", (data) => {
            const groups = data.favoriteGroups || [];
            // Check for duplicate name (optional, but good practice)
            if (groups.some(g => g.name.toLowerCase() === groupName.toLowerCase())) {
                alert(`A group named "${groupName}" already exists.`);
                return;
            }

            groups.push({ name: groupName, streamers: [] });

            chrome.storage.local.set({ favoriteGroups: groups }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving new group:", chrome.runtime.lastError);
                    alert("Failed to save the new group.");
                } else {
                    console.log("Group saved:", groupName);
                    closeModal();
                    displayGroups(); // Update the displayed list
                    chrome.runtime.sendMessage({ action: "settingsChanged" });
                }
            });
        });
    };

    saveButton.addEventListener("click", saveGroup);
}

/**
 * Initializes the Favorite Groups section of the settings page.
 * Sets up the initial display and event listeners for group management.
 */
function initializeFavoriteGroupsSection() {
    console.log("Initializing Favorite Groups Section...");
    displayGroups(); // Load the groups list on startup
    setupAddGroupModal(); // Set up the "Add new favorite group" button/modal
    console.log("Favorite Groups Section Initialized.");
}