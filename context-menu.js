// context-menu.js

/**
 * Sets up inline editing functionality for a group name span.
 * @param {HTMLElement} groupNameSpan - The span element displaying the group name.
 * @param {HTMLElement} editButton - The button used to trigger editing.
 * @param {string} groupName - The initial name of the group.
 * @returns {object} Object containing a method to get the current group name.
 */
function setupGroupEditing(groupNameSpan, editButton, groupName) {
    let editingActive = false;
    let currentGroupName = groupName;
    let hasUnsavedChanges = false;

    const saveEdit = () => {
        if (!editingActive) return;

        const newName = groupNameSpan.textContent.trim();
        const originalName = currentGroupName;

        if (newName && newName !== originalName) {
            chrome.storage.local.get("favoriteGroups", function (data) {
                const currentGroups = data.favoriteGroups || [];
                const groupIndexToUpdate = currentGroups.findIndex(g => g.name === originalName);
                if (groupIndexToUpdate !== -1) {
                    // Check for duplicate names before saving
                    if (currentGroups.some((g, i) => g.name === newName && i !== groupIndexToUpdate)) {
                        alert("A group with this name already exists.");
                        groupNameSpan.textContent = originalName; // Revert display
                    } else {
                        currentGroups[groupIndexToUpdate].name = newName;
                        chrome.storage.local.set({ favoriteGroups: currentGroups }, function () {
                            if (chrome.runtime.lastError) {
                                console.error("Error saving updated group name:", chrome.runtime.lastError);
                                alert("Error saving group name.");
                                groupNameSpan.textContent = originalName; // Revert display on error
                            } else {
                                console.log("Group name updated:", newName);
                                currentGroupName = newName; // Update internal state
                                if (typeof updateLiveStreams === 'function') updateLiveStreams(); // Refresh main list if function exists
                            }
                        });
                    }
                } else {
                    console.error("Could not find group to update:", originalName);
                    groupNameSpan.textContent = originalName; // Revert display
                }
            });
        } else if (!newName) { // Handle empty name case
            alert("Group name cannot be empty.");
            groupNameSpan.textContent = originalName; // Revert display
        }
        // If newName is the same as originalName, do nothing significant, just exit edit mode
    };

    const exitEditMode = (forceRevert = false) => {
        if (!editingActive) return;

        editingActive = false;
        hasUnsavedChanges = false;

        if (forceRevert) {
            groupNameSpan.textContent = currentGroupName; // Revert text content if needed (e.g., on Escape)
        }

        // Reset edit button to original state
        editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="edit-icon">
<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
</svg>`;
        editButton.title = "Edit";
        editButton.classList.remove("editing-active", "has-changes");

        groupNameSpan.contentEditable = false;
        groupNameSpan.classList.remove("editing");
        groupNameSpan.style.whiteSpace = "nowrap";
        groupNameSpan.style.overflow = "hidden";
        groupNameSpan.style.textOverflow = "ellipsis";

        // Clean up event handlers
        groupNameSpan.onkeydown = null;
        groupNameSpan.onblur = null;
        groupNameSpan.oninput = null;
    };

    const enterEditMode = () => {
        if (editingActive) return;

        editingActive = true;
        hasUnsavedChanges = false;
        const originalName = currentGroupName; // Store the name *before* editing starts

        // Change edit button to save button with text
        editButton.innerHTML = `Save`;
        editButton.title = "Save changes";
        editButton.classList.add("editing-active");

        groupNameSpan.style.whiteSpace = "normal";
        groupNameSpan.style.overflow = "visible";
        groupNameSpan.style.textOverflow = "unset";
        groupNameSpan.contentEditable = true;
        groupNameSpan.classList.add("editing");
        groupNameSpan.focus();

        // Select all text within the span for easy editing
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(groupNameSpan);
        range.collapse(false); // Collapse to end
        selection.removeAllRanges();
        selection.addRange(range);

        // Track changes to content
        groupNameSpan.oninput = () => {
            const trimmedName = groupNameSpan.textContent.trim();
            if (!hasUnsavedChanges && trimmedName && trimmedName !== originalName) {
                hasUnsavedChanges = true;
                editButton.classList.add("has-changes");
            } else if (trimmedName === originalName || !trimmedName) {
                hasUnsavedChanges = false;
                editButton.classList.remove("has-changes");
            }
        };

        groupNameSpan.onkeydown = function (e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent newline in contentEditable
                saveEdit();
                exitEditMode();
                groupNameSpan.blur(); // Remove focus
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // No need to save, just exit and revert visually
                exitEditMode(true); // Pass true to force revert display
                groupNameSpan.blur(); // Remove focus
            }
        };

        // Save on blur only if there are actual changes
        groupNameSpan.onblur = () => {
            // Use a small delay to allow clicking the save button without triggering blur first
            setTimeout(() => {
                // Check if we are still in edit mode (e.g., didn't click save/cancel)
                if (editingActive) {
                    if (hasUnsavedChanges) {
                        saveEdit();
                    }
                    exitEditMode();
                }
            }, 100); // 100ms delay
        };
    };

    // Set up click handler for edit button to toggle between edit and save
    editButton.onclick = (e) => {
        e.stopPropagation(); // Prevent click bubbling to menu item
        if (editingActive) {
            saveEdit();
            exitEditMode();
        } else {
            enterEditMode();
        }
    };

    // Return current group name for reference, especially for deletion logic
    return {
        getCurrentGroupName: () => currentGroupName
    };
}

/**
 * Creates a new favorite group, adds the specified stream, updates storage, and adds the group to the context menu UI.
 * @param {string} groupName - The name for the new group.
 * @param {object} stream - The stream object to add to the new group.
 * @param {HTMLElement} contextMenu - The context menu element to update visually.
 * @returns {Promise<object|string>} Resolves with the new group object or rejects with an error message ('duplicate' or storage error).
 */
function createNewGroup(groupName, stream, contextMenu) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get("favoriteGroups", function (data) {
            const groups = data.favoriteGroups || [];
            // Check for existing group with the same name (case-insensitive check for robustness)
            if (!groups.some((g) => g.name.toLowerCase() === groupName.toLowerCase())) {
                const newGroup = {
                    name: groupName, // Store with original casing
                    streamers: [stream.channelName],
                };
                groups.push(newGroup);
                // Sort groups alphabetically after adding
                groups.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

                chrome.storage.local.set({ favoriteGroups: groups }, function () {
                    if (chrome.runtime.lastError) {
                        console.error("Error saving new group:", chrome.runtime.lastError);
                        alert("Error saving new group.");
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    console.log(`New group '${groupName}' created and added ${stream.channelName}`);
                    if (typeof updateLiveStreams === 'function') updateLiveStreams(); // Refresh main list

                    // --- Visually Add New Group Item to Context Menu ---

                    // Find the correct index based on the newly sorted groups array
                    const newIndex = groups.findIndex(g => g.name === groupName);

                    const menuItem = document.createElement("div");
                    menuItem.className = "context-menu-item";

                    const checkBox = document.createElement("input");
                    checkBox.type = "checkbox";
                    checkBox.checked = true; // Checked because we just added the current stream

                    const groupContainer = document.createElement("div");
                    groupContainer.className = "group-name-container";

                    const groupNameSpan = document.createElement("span");
                    groupNameSpan.className = "group-name";
                    groupNameSpan.textContent = groupName;

                    const actionsContainer = document.createElement("div");
                    actionsContainer.className = "actions-container";

                    const editButton = document.createElement("button");
                    editButton.className = "edit-group-btn";
                    editButton.title = "Edit";
                    editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="edit-icon">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>`;

                    const deleteButton = document.createElement("button");
                    deleteButton.className = "delete-group-button";
                    deleteButton.title = "Delete";
                    deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="delete-icon">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>`;

                    actionsContainer.appendChild(editButton);
                    actionsContainer.appendChild(deleteButton);
                    groupContainer.appendChild(groupNameSpan);
                    groupContainer.appendChild(actionsContainer);
                    menuItem.appendChild(checkBox);
                    menuItem.appendChild(groupContainer);

                    // Set up group editing for the newly created item
                    const groupEditor = setupGroupEditing(groupNameSpan, editButton, groupName);

                    // Attach delete functionality
                    deleteButton.onclick = function (event) {
                        event.stopPropagation(); // Prevent triggering menu item click
                        // Need to find the current index dynamically when deleting
                        chrome.storage.local.get("favoriteGroups", (data) => {
                            const currentGroups = data.favoriteGroups || [];
                            const currentIndex = currentGroups.findIndex(g => g.name === groupEditor.getCurrentGroupName());
                            if (currentIndex !== -1) {
                                deleteGroup(currentIndex, groupEditor.getCurrentGroupName(), contextMenu);
                            } else {
                                console.error("Group not found for deletion:", groupEditor.getCurrentGroupName());
                                // Maybe remove the item visually anyway if storage is out of sync?
                                menuItem.remove();
                                alert("Could not find the group to delete. It might have already been removed.");
                            }
                        });
                    };

                    // Handle clicking the menu item row (excluding buttons/checkbox)
                    menuItem.addEventListener("click", function (event) {
                        // Only toggle checkbox if the click is not on the edit/delete buttons, the checkbox itself, or the editable span
                        if (!actionsContainer.contains(event.target) &&
                            event.target !== checkBox &&
                            !groupNameSpan.isContentEditable) {
                            checkBox.checked = !checkBox.checked;
                            // Manually dispatch change event to trigger add/remove logic
                            checkBox.dispatchEvent(new Event("change"));
                        }
                    });

                    // Handle checkbox changes
                    checkBox.addEventListener("change", function () {
                        if (checkBox.checked) {
                            addToGroup(stream, groupEditor.getCurrentGroupName());
                        } else {
                            removeFromGroup(stream, groupEditor.getCurrentGroupName());
                        }
                    });

                    // Add the new menu item to the DOM in the correct sorted position
                    const itemsContainer = contextMenu.querySelector(".context-menu-items-container");
                    if (itemsContainer) {
                        const noGroupMsg = itemsContainer.querySelector(".context-menu-item:not(.add-new-group-button)"); // Select item that isn't the button
                        // Check if the "No groups" message exists and remove it
                        if (noGroupMsg && noGroupMsg.textContent === "No favorite groups found.") {
                            noGroupMsg.remove();
                        }

                        // Insert the new item at the correct sorted index
                        const existingItems = itemsContainer.querySelectorAll('.context-menu-item:not(.add-new-group-button)');
                        if (newIndex >= 0 && newIndex < existingItems.length) {
                            itemsContainer.insertBefore(menuItem, existingItems[newIndex]);
                        } else {
                            itemsContainer.appendChild(menuItem); // Append if last or only item
                        }


                        // Add highlight class for visual feedback
                        menuItem.classList.add("new-item-highlight");

                        // Auto scroll to the newly added item if it's not fully visible
                        menuItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                        // Remove highlight after animation completes (adjust timeout based on CSS animation duration)
                        setTimeout(() => {
                            // Check if the item still exists before removing class
                            if (menuItem && menuItem.parentNode) {
                                menuItem.classList.remove("new-item-highlight");
                            }
                        }, 3000); // Match CSS animation duration or slightly longer
                    }

                    resolve(newGroup); // Resolve the promise with the new group data
                });
            } else {
                alert("A group with this name already exists.");
                reject("duplicate"); // Reject specifically for duplicate case
            }
        });
    });
}

/**
 * Displays the custom context menu for a given stream at specified coordinates.
 * @param {object} stream - The stream object associated with the right-clicked item.
 * @param {number} x - The horizontal (pageX) coordinate for the menu.
 * @param {number} y - The vertical (pageY) coordinate for the menu.
 */
function showContextMenu(stream, x, y) {
    // Remove any existing context menu first
    const existingMenu = document.querySelector(".custom-context-menu");
    if (existingMenu) existingMenu.remove();

    const contextMenu = document.createElement("div");
    contextMenu.className = "custom-context-menu";
    contextMenu.style.opacity = '0'; // Start hidden for position calculation

    // --- Menu Header ---
    const menuHeader = document.createElement("div");
    menuHeader.className = "context-menu-header";

    const firstPart = document.createElement("span");
    firstPart.textContent = "Add";
    firstPart.classList.add("context-menu-header-text");

    const twitchCombo = document.createElement("span");
    twitchCombo.className = "twitch-combo";

    const twitchIcon = document.createElement("img");
    twitchIcon.src = "css/twitch.png"; // Ensure this path is correct relative to popup.html
    twitchIcon.alt = "Twitch";
    twitchIcon.classList.add("context-menu-twitch-icon");

    const channelNameSpan = document.createElement("span");
    channelNameSpan.textContent = stream.channelName;
    channelNameSpan.classList.add("context-menu-stream-name");
    // Add tooltip for long channel names
    channelNameSpan.title = stream.channelName;

    const toFavoriteGroupText = document.createElement("span");
    toFavoriteGroupText.classList.add("context-menu-header-text");
    // Start with full text - we'll adjust later if needed
    toFavoriteGroupText.textContent = "to favorite list:";

    twitchCombo.appendChild(twitchIcon);
    twitchCombo.appendChild(channelNameSpan);

    // Create a wrapper for the stream name and text to keep them together
    const nameAndTextWrapper = document.createElement("div");
    nameAndTextWrapper.style.display = "flex";
    nameAndTextWrapper.style.alignItems = "center";
    nameAndTextWrapper.style.flexShrink = "1";
    nameAndTextWrapper.style.minWidth = "0";
    nameAndTextWrapper.style.overflow = "hidden";

    menuHeader.appendChild(firstPart);
    menuHeader.appendChild(nameAndTextWrapper);

    // Add consistent gap between elements
    twitchCombo.style.marginRight = "4px";

    // Put these elements in the wrapper to keep them together
    nameAndTextWrapper.appendChild(twitchCombo);
    nameAndTextWrapper.appendChild(toFavoriteGroupText);

    contextMenu.appendChild(menuHeader);

    // --- Scrollable Items Container ---
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "context-menu-items-container";
    contextMenu.appendChild(itemsContainer);

    // --- Footer for "Add New" ---
    const footerContainer = document.createElement("div");
    footerContainer.className = "context-menu-footer";
    contextMenu.appendChild(footerContainer);

    // --- Populate with Favorite Groups ---
    chrome.storage.local.get("favoriteGroups", function (data) {
        const groups = data.favoriteGroups || [];

        // Sort groups alphabetically before displaying
        groups.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        if (groups.length > 0) {
            groups.forEach((group, index) => { // Keep track of the original index after sorting
                const menuItem = document.createElement("div");
                menuItem.className = "context-menu-item";

                const checkBox = document.createElement("input");
                checkBox.type = "checkbox";
                // Check if the current stream is in this group's streamers list
                checkBox.checked = group.streamers.some(s => s.toLowerCase() === stream.channelName.toLowerCase());

                const groupContainer = document.createElement("div");
                groupContainer.className = "group-name-container";

                const groupNameSpan = document.createElement("span");
                groupNameSpan.className = "group-name";
                groupNameSpan.textContent = group.name;
                groupNameSpan.title = group.name; // Tooltip for long names

                const actionsContainer = document.createElement("div");
                actionsContainer.className = "actions-container";

                // Edit Button (Feather icon)
                const editButton = document.createElement("button");
                editButton.className = "edit-group-btn";
                editButton.title = "Edit";
                editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="edit-icon">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>`;

                // Delete Button (Feather icon)
                const deleteButton = document.createElement("button");
                deleteButton.className = "delete-group-button";
                deleteButton.title = "Delete";
                deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="delete-icon">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>`;

                actionsContainer.appendChild(editButton);
                actionsContainer.appendChild(deleteButton);
                groupContainer.appendChild(groupNameSpan);
                groupContainer.appendChild(actionsContainer);
                menuItem.appendChild(checkBox);
                menuItem.appendChild(groupContainer);

                // Set up group editing using the shared utility function
                const groupEditor = setupGroupEditing(groupNameSpan, editButton, group.name);

                // Delete button action
                deleteButton.onclick = (event) => {
                    event.stopPropagation(); // Prevent menu item click
                    // Find the current index dynamically before deleting
                    chrome.storage.local.get("favoriteGroups", (data) => {
                        const currentGroups = data.favoriteGroups || [];
                        // Use the potentially updated group name from the editor
                        const currentGroupName = groupEditor.getCurrentGroupName();
                        const currentIndex = currentGroups.findIndex(g => g.name === currentGroupName);
                        if (currentIndex !== -1) {
                            deleteGroup(currentIndex, currentGroupName, contextMenu);
                        } else {
                            console.error("Group not found for deletion:", currentGroupName);
                            menuItem.remove(); // Remove visually anyway
                            alert("Could not find the group to delete. It might have already been removed.");
                        }
                    });
                };

                // Handle clicking the menu item row (excluding buttons/checkbox/editing span)
                menuItem.addEventListener("click", (event) => {
                    if (!actionsContainer.contains(event.target) &&
                        event.target !== checkBox &&
                        !groupNameSpan.isContentEditable) {
                        checkBox.checked = !checkBox.checked;
                        checkBox.dispatchEvent(new Event("change")); // Trigger add/remove logic
                    }
                });

                // Handle checkbox state changes
                checkBox.addEventListener("change", () => {
                    const currentGroupName = groupEditor.getCurrentGroupName(); // Get potentially edited name
                    if (checkBox.checked) {
                        addToGroup(stream, currentGroupName);
                    } else {
                        removeFromGroup(stream, currentGroupName);
                    }
                });

                itemsContainer.appendChild(menuItem);
            });
        } else {
            // Display message if no groups exist
            const noGroupItem = document.createElement("div");
            noGroupItem.textContent = "No favorite groups found.";
            noGroupItem.className = "context-menu-item no-groups-message"; // Add specific class
            itemsContainer.appendChild(noGroupItem);
        }

        // --- Add New Group Button ---
        const addNewGroupButtonElement = document.createElement("div");
        addNewGroupButtonElement.textContent = "Add new favorite list";
        addNewGroupButtonElement.className = "context-menu-item add-new-group-button";
        addNewGroupButtonElement.style.display = 'block'; // Ensure it's visible initially

        addNewGroupButtonElement.onclick = function () {
            addNewGroupButtonElement.style.display = 'none'; // Hide button
            // Pass the button itself to the form function so it can be reshown
            openAddGroupForm(footerContainer, stream, addNewGroupButtonElement);
        };

        // Append the "Add New" button to the footer
        footerContainer.appendChild(addNewGroupButtonElement);

        // Append the fully constructed menu to the body (initially invisible)
        document.body.appendChild(contextMenu);

        // --- Position Calculation and Display ---
        // Use requestAnimationFrame to ensure layout is calculated before positioning
        requestAnimationFrame(() => {
            const menuWidth = contextMenu.offsetWidth;
            const menuHeight = contextMenu.offsetHeight;
            const margin = 5; // Small margin from window edges

            // Check if channel name is being truncated
            if (channelNameSpan.scrollWidth > channelNameSpan.clientWidth) {
                // Channel name is being cut off, let's check if shortening the suffix text helps
                if (toFavoriteGroupText.textContent === "to favorite list:") {
                    toFavoriteGroupText.textContent = "to list:"; // Use shorter text
                }
            }

            // Calculate safe coordinates to keep the menu within viewport bounds
            let finalX = x;
            let finalY = y;

            if (x + menuWidth + margin > window.innerWidth) {
                finalX = window.innerWidth - menuWidth - margin;
            }
            if (y + menuHeight + margin > window.innerHeight) {
                finalY = window.innerHeight - menuHeight - margin;
            }
            // Ensure menu doesn't go off the top or left edges either
            finalX = Math.max(margin, finalX);
            finalY = Math.max(margin, finalY);

            contextMenu.style.left = `${finalX}px`;
            contextMenu.style.top = `${finalY}px`;
            contextMenu.style.opacity = '1'; // Make visible

            // --- Click-away Listener ---
            // Use a named function for easier removal
            function closeMenuOnClickAway(event) {
                // Check if the click was outside the context menu *and* not on the original item that triggered it (optional)
                if (contextMenu && !contextMenu.contains(event.target)) {
                    contextMenu.remove();
                    document.removeEventListener("click", closeMenuOnClickAway, { capture: true });
                    document.removeEventListener("contextmenu", closeMenuOnClickAway, { capture: true }); // Also close on another right-click
                }
            }
            // Add listeners - use capture phase to catch clicks early
            document.addEventListener("click", closeMenuOnClickAway, { capture: true });
            document.addEventListener("contextmenu", closeMenuOnClickAway, { capture: true }); // Close on subsequent right-clicks anywhere
        });
    });
}


/**
 * Adds a stream to a specified favorite group in storage.
 * @param {object} stream - The stream object containing channelName.
 * @param {string} groupName - The name of the group to add the stream to.
 */
function addToGroup(stream, groupName) {
    chrome.storage.local.get("favoriteGroups", function (data) {
        const groups = data.favoriteGroups || [];
        const group = groups.find((g) => g.name === groupName);
        // Add only if the group exists and the streamer isn't already in it (case-insensitive check)
        if (group && !group.streamers.some(s => s.toLowerCase() === stream.channelName.toLowerCase())) {
            group.streamers.push(stream.channelName);
            // Keep streamers sorted alphabetically within the group
            group.streamers.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            chrome.storage.local.set({ favoriteGroups: groups }, function () {
                if (chrome.runtime.lastError) {
                    console.error(`Error adding ${stream.channelName} to ${groupName}:`, chrome.runtime.lastError);
                } else {
                    console.log(`Added ${stream.channelName} to ${groupName}`);
                    if (typeof updateLiveStreams === 'function') updateLiveStreams(); // Refresh main list
                }
            });
        } else if (!group) {
            console.warn(`Attempted to add to non-existent group: ${groupName}`);
        }
    });
}

/**
 * Removes a stream from a specified favorite group in storage.
 * @param {object} stream - The stream object containing channelName.
 * @param {string} groupName - The name of the group to remove the stream from.
 */
function removeFromGroup(stream, groupName) {
    chrome.storage.local.get("favoriteGroups", function (data) {
        const groups = data.favoriteGroups || [];
        const group = groups.find((g) => g.name === groupName);
        if (group) {
            const initialLength = group.streamers.length;
            // Filter out the streamer (case-insensitive check)
            group.streamers = group.streamers.filter((s) => s.toLowerCase() !== stream.channelName.toLowerCase());
            // Only update storage if a streamer was actually removed
            if (group.streamers.length < initialLength) {
                chrome.storage.local.set({ favoriteGroups: groups }, function () {
                    if (chrome.runtime.lastError) {
                        console.error(`Error removing ${stream.channelName} from ${groupName}:`, chrome.runtime.lastError);
                    } else {
                        console.log(`Removed ${stream.channelName} from ${groupName}`);
                        if (typeof updateLiveStreams === 'function') updateLiveStreams(); // Refresh main list
                    }
                });
            }
        } else {
            console.warn(`Attempted to remove from non-existent group: ${groupName}`);
        }
    });
}


/**
 * Opens the inline form for adding a new favorite group within the context menu footer.
 * @param {HTMLElement} footerContainer - The footer element of the context menu where the form will be added.
 * @param {object} stream - The stream object, needed if the new group should immediately include this stream.
 * @param {HTMLElement} addNewGroupButtonElement - The button that triggered this form, to be re-shown on cancel/completion.
 */
function openAddGroupForm(footerContainer, stream, addNewGroupButtonElement) {
    // Remove existing form if any (shouldn't happen with hide/show logic, but safe)
    const existingForm = footerContainer.querySelector(".new-group-form");
    if (existingForm) {
        existingForm.remove();
    }

    // --- Create Form Elements ---
    const formContainer = document.createElement("div");
    formContainer.className = "new-group-form";

    const formHeader = document.createElement("div");
    formHeader.className = "new-group-form-header";

    // Cancel 'X' Button
    const cancelButton = document.createElement("button");
    cancelButton.className = "cancel-new-group-icon";
    cancelButton.type = 'button';
    cancelButton.title = "Cancel";
    cancelButton.setAttribute('aria-label', 'Cancel adding new group');
    cancelButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;

    const inputContainer = document.createElement("div");
    inputContainer.className = "new-group-form-input-container";

    const groupNameInput = document.createElement("input");
    groupNameInput.type = "text";
    groupNameInput.placeholder = "Enter new group name";
    groupNameInput.className = "group-name-input";
    groupNameInput.maxLength = 50; // Add a reasonable max length

    const submitButton = document.createElement("button");
    submitButton.textContent = "Save";
    submitButton.className = "submit-new-group";
    submitButton.type = 'button'; // Explicitly set type

    // Assemble the form
    formHeader.appendChild(cancelButton); // Add cancel button to header
    formContainer.appendChild(formHeader);
    inputContainer.appendChild(groupNameInput);
    inputContainer.appendChild(submitButton);
    formContainer.appendChild(inputContainer);


    // Function to clean up the form and show the original button
    const cleanupAndShowButton = () => {
        if (formContainer.parentNode) {
            formContainer.remove();
        }
        // Ensure the button is visible again
        addNewGroupButtonElement.style.display = 'block';
    };

    // Append the form to the footer container (replacing the button visually)
    footerContainer.appendChild(formContainer);

    // Focus the input field immediately
    groupNameInput.focus();

    // --- Event Handlers ---

    // Handle Submit Button Click
    submitButton.onclick = async function () {
        const groupName = groupNameInput.value.trim();
        if (groupName) {
            try {
                // Get the context menu element to pass to createNewGroup
                const contextMenu = footerContainer.closest(".custom-context-menu");
                if (!contextMenu) {
                    console.error("Could not find parent context menu element.");
                    alert("An error occurred. Could not create group.");
                    cleanupAndShowButton();
                    return;
                }
                await createNewGroup(groupName, stream, contextMenu);
                cleanupAndShowButton(); // Clean up on success
            } catch (error) {
                // If error is 'duplicate', the alert is handled in createNewGroup, just keep form open
                if (error !== "duplicate") {
                    console.error("Error during group creation:", error);
                    cleanupAndShowButton(); // Clean up on other errors
                } else {
                    groupNameInput.focus(); // Keep focus on input for correction
                    groupNameInput.select(); // Select text
                }
            }
            // Note: No 'finally' here, cleanup happens on success or non-duplicate error
        } else {
            alert("Please enter a valid group name.");
            groupNameInput.focus();
        }
    };

    // Handle Enter key press in input field
    groupNameInput.addEventListener("keydown", async function (event) {
        if (event.key === "Enter") {
            event.preventDefault(); // Prevent potential form submission if it were a real form
            submitButton.click(); // Trigger the click handler logic
        } else if (event.key === "Escape") {
            event.preventDefault();
            cleanupAndShowButton(); // Cancel on Escape
        }
    });

    // Handle Cancel button click
    cancelButton.onclick = function () {
        cleanupAndShowButton();
    };

    // Handle clicking outside the form (within the footer) - might be complex, rely on Escape/Cancel button for now.
}


/**
 * Deletes a favorite group from storage and removes its corresponding item from the context menu UI.
 * @param {number} index - The index of the group to delete in the *current* storage array.
 * @param {string} groupName - The name of the group (used for confirmation/logging).
 * @param {HTMLElement} contextMenu - The context menu element containing the item to remove.
 */
function deleteGroup(index, groupName, contextMenu) {
    // Confirmation dialog
    if (!confirm(`Are you sure you want to delete the group "${groupName}"?`)) {
        return; // Stop if user cancels
    }

    chrome.storage.local.get("favoriteGroups", function (data) {
        var groups = data.favoriteGroups || [];

        // Double-check index validity before splicing
        if (index >= 0 && index < groups.length) {
            // Verify the name matches just in case the index is stale (though less likely now with dynamic index finding)
            if (groups[index].name === groupName) {
                const deletedGroupName = groups[index].name;
                groups.splice(index, 1); // Remove the group from the array

                chrome.storage.local.set({ favoriteGroups: groups }, function () {
                    if (chrome.runtime.lastError) {
                        console.error("Error deleting group:", chrome.runtime.lastError);
                        alert(`Error deleting group "${deletedGroupName}".`);
                    } else {
                        console.log("Group deleted:", deletedGroupName);

                        // --- Remove the item from the context menu UI ---
                        const itemsContainer = contextMenu.querySelector(".context-menu-items-container");
                        if (itemsContainer) {
                            // Find the item visually - it might not be exactly at `index` if sorting/filtering happened UI-side
                            const menuItems = itemsContainer.querySelectorAll(".context-menu-item:not(.add-new-group-button):not(.no-groups-message)");
                            let itemToRemove = null;
                            menuItems.forEach(item => {
                                const nameSpan = item.querySelector('.group-name');
                                if (nameSpan && nameSpan.textContent === deletedGroupName) {
                                    itemToRemove = item;
                                }
                            });

                            if (itemToRemove) {
                                itemToRemove.remove();
                            } else {
                                console.warn("Could not find menu item to remove for deleted group:", deletedGroupName);
                            }


                            // If no groups are left, show the "No favorite groups" message
                            if (groups.length === 0 && itemsContainer.querySelectorAll(".context-menu-item:not(.add-new-group-button)").length === 0) {
                                const noGroupItem = document.createElement("div");
                                noGroupItem.textContent = "No favorite groups found.";
                                noGroupItem.className = "context-menu-item no-groups-message"; // Use specific class
                                // Clear any potential leftover items before adding message
                                itemsContainer.innerHTML = '';
                                itemsContainer.appendChild(noGroupItem);
                            }
                        }

                        // Refresh the main popup list
                        if (typeof updateLiveStreams === 'function') updateLiveStreams();
                    }
                });
            } else {
                console.error("Group name mismatch at index", index, ". Expected:", groupName, "Found:", groups[index].name);
                alert("Error: Group data seems out of sync. Could not delete.");
            }
        } else {
            console.error("Invalid index provided for group deletion:", index);
            alert("Error: Could not find the group to delete. It might have already been removed.");
            // Attempt to remove visually if possible based on name
            const itemsContainer = contextMenu.querySelector(".context-menu-items-container");
            if (itemsContainer) {
                const menuItems = itemsContainer.querySelectorAll(".context-menu-item:not(.add-new-group-button)");
                menuItems.forEach(item => {
                    const nameSpan = item.querySelector('.group-name');
                    if (nameSpan && nameSpan.textContent === groupName) {
                        item.remove();
                    }
                });
            }
        }
    });
}