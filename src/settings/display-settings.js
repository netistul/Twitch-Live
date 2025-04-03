// settings/display-settings.js
//
/** Sets up general settings checkboxes (Show Avatar, Hide Accessed Count) */
function setupGeneralSettings() {
    // --- Show Avatar Checkbox ---
    const showAvatarCheckbox = document.getElementById("showAvatarCheckbox");
    if (showAvatarCheckbox) {
        // Load initial state for the avatar checkbox
        chrome.storage.local.get("showAvatar", function (data) {
            const isShowAvatar = data.showAvatar !== undefined ? data.showAvatar : true; // Default true
            showAvatarCheckbox.checked = isShowAvatar;

            // --- Call the state update function RIGHT AFTER setting initial checkbox state ---
            updateTitleDisplayDropdownState(isShowAvatar);
            // --- End of change ---

            // Save default if not set
            if (data.showAvatar === undefined) {
                chrome.storage.local.set({ showAvatar: true });
            }
        });

        // Add change listener to the avatar checkbox
        showAvatarCheckbox.addEventListener("change", function () {
            const isChecked = this.checked;
            let updates = { showAvatar: isChecked };

            // --- Call the state update function WHENEVER the checkbox changes ---
            updateTitleDisplayDropdownState(isChecked);
            // --- End of change ---

            // If disabling avatar, check and potentially reset streamTitleDisplay
            if (!isChecked) {
                chrome.storage.local.get("streamTitleDisplay", function (result) {
                    if (result.streamTitleDisplay === "newline") {
                        updates.streamTitleDisplay = "hover"; // Add to updates object
                        console.log("Avatar disabled, resetting stream title display to hover");
                        // Update the dropdown UI immediately to reflect the change
                        updateDropdownUI('streamTitleDisplaySelect', 'hover');
                    }
                    // Save potentially modified updates
                    saveSettingsAndNotify(updates);
                });
            } else {
                // Just save the avatar setting if enabling
                saveSettingsAndNotify(updates);
            }

            updatePreview(); // Update preview instantly
        });
    } else {
        console.error("Show Avatar Checkbox not found.");
    }

    // --- Hide Accessed Count Checkbox (No changes needed here) ---
    const hideCountCheckbox = document.getElementById("hideAccessedCountCheckbox");
    if (hideCountCheckbox) {
        chrome.storage.local.get("hideAccessedCount", function (data) {
            const isHidden = data.hideAccessedCount !== undefined ? data.hideAccessedCount : false;
            hideCountCheckbox.checked = isHidden;
        });
        hideCountCheckbox.addEventListener("change", function () {
            const isChecked = this.checked;
            saveSettingsAndNotify({ hideAccessedCount: isChecked });
        });
    } else {
        console.error("Hide Accessed Count Checkbox not found.");
    }
}


/** Sets up the custom dropdowns for display options */
function setupDisplayOptions() {
    try {
        const dropdownContainers = document.querySelectorAll('.custom-select-container');
        if (!dropdownContainers.length) {
            console.warn("No custom dropdown containers found.");
            return;
        }

        // Mapping from select element ID to storage key
        const storageKeyMap = {
            "showStreamTimeSelect": "showStreamTime",
            "streamGroupingSelect": "streamGrouping", // Correct ID
            "streamTitleDisplaySelect": "streamTitleDisplay",
            "themeSelect": "darkMode",
        };

        // Default values mapping
        const defaultValues = {
            "showStreamTime": "off",
            // --- CHANGE THIS LINE ---
            "streamGrouping": "none", // Align with HTML value="none"
            // --- End of Change ---
            "streamTitleDisplay": "hover",
            "darkMode": "dark" // Default theme
        };

        dropdownContainers.forEach(container => {
            const selectElement = container.querySelector('select');
            if (selectElement) {
                const selectId = selectElement.id;
                const storageKey = storageKeyMap[selectId];
                // Ensure storageKey exists before proceeding
                if (storageKey) {
                    const defaultValue = defaultValues[storageKey]; // Get the correct default
                    initializeSingleDropdown(container, selectId, storageKey, defaultValue);
                } else {
                    console.warn(`No storage key mapping found for select ID: ${selectId}`);
                }
            } else {
                console.warn("Custom select container found without a <select> element inside.", container);
            }
        });

        // Add listener to close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.custom-select-container.open').forEach(container => {
                if (!container.contains(e.target)) {
                    container.classList.remove('open');
                }
            });
        });

        // Initial theme application based on stored value or default
        chrome.storage.local.get("darkMode", data => {
            const theme = data.darkMode || defaultValues.darkMode; // Use default from map
            setTheme(theme);
        });

    } catch (error) {
        console.error('Error setting up display options dropdowns:', error);
    }
}

/**
* Initializes a single custom dropdown.
* @param {HTMLElement} selectContainer - The main container div for the custom dropdown.
* @param {string} selectId - The ID of the original <select> element.
* @param {string} storageKey - The key used in chrome.storage.local.
* @param {string} defaultValue - The default value if none is stored.
*/
function initializeSingleDropdown(selectContainer, selectId, storageKey, defaultValue) {
    try {
        const header = selectContainer.querySelector('.custom-select-header');
        const selectedTextElement = header?.querySelector('.selected-option'); // Renamed for clarity
        const optionsList = selectContainer.querySelector('.custom-select-options');
        const options = optionsList?.querySelectorAll('.custom-option');
        const originalSelect = document.getElementById(selectId);

        if (!header || !selectedTextElement || !optionsList || !options?.length || !originalSelect) {
            console.error(`Dropdown elements missing for ${selectId}`);
            selectContainer.style.display = 'none'; // Hide broken dropdown
            return;
        }

        // --- Load Initial Value ---
        chrome.storage.local.get(storageKey, function (data) {
            const currentValue = data[storageKey] !== undefined ? data[storageKey] : defaultValue;
            updateDropdownUI(selectId, currentValue); // Update both original select and custom UI
        });

        // --- Event Listener for Header Click (Toggle) ---
        header.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click listener from closing it immediately

            // If disabled (e.g., Title Display when Avatar off), do nothing
            if (selectContainer.classList.contains('disabled')) return;

            // Close other dropdowns first
            document.querySelectorAll('.custom-select-container.open').forEach(otherContainer => {
                if (otherContainer !== selectContainer) {
                    otherContainer.classList.remove('open');
                }
            });

            // Toggle current dropdown
            const isOpen = selectContainer.classList.toggle('open');

            // Adjust dropdown position if needed (prevent viewport overflow)
            if (isOpen) {
                adjustDropdownPosition(selectContainer, optionsList, header);
            }
        });

        // --- Event Listener for Option Click (Select) ---
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const newValue = option.dataset.value;

                if (newValue === undefined) {
                    console.warn("Option clicked without data-value:", option);
                    return;
                }

                // Update UI and original select
                updateDropdownUI(selectId, newValue);

                // Close dropdown
                selectContainer.classList.remove('open');

                // --- Handle Side Effects and Save ---
                handleDropdownChange(storageKey, newValue, selectId);
            });
        });

    } catch (error) {
        console.error(`Error initializing dropdown ${selectId}:`, error);
        if (selectContainer) selectContainer.style.display = 'none'; // Hide broken dropdown
    }
}

/**
 * Handles the logic after a dropdown value changes, including side effects and saving.
 * @param {string} storageKey - The storage key for the setting.
 * @param {string} newValue - The newly selected value.
 * @param {string} selectId - The ID of the select element changed.
 */
function handleDropdownChange(storageKey, newValue, selectId) {
    console.log(`Dropdown changed: ${storageKey} = ${newValue}`);
    let updates = { [storageKey]: newValue };
    let applyThemeChange = false;
    let themeToApply = '';
    // No need for sendSpecificThemeUpdate flag anymore

    // --- Side Effect Logic ---
    if (storageKey === "streamTitleDisplay") {
        // Logic when "Thumbnail" (newline) is selected
        if (newValue === "newline") {
            console.log("Newline display selected. Forcing Stream Time ON and checking theme.");
            updates.showStreamTime = "on";
            updateDropdownUI('showStreamTimeSelect', 'on'); // Update stream time dropdown UI

            // Check current theme and potentially switch to very dark
            chrome.storage.local.get("darkMode", function (themeData) {
                const currentTheme = themeData.darkMode || 'dark'; // Assume dark if unset
                if (currentTheme === "dark") {
                    console.log("Switching theme to verydark for newline display.");
                    updates.darkMode = "verydark";
                    updateDropdownUI('themeSelect', 'verydark'); // Update theme dropdown UI
                    applyThemeChange = true;
                    themeToApply = 'verydark';
                }
                // Save all updates together. saveSettingsAndNotify will send oauthComplete
                saveSettingsAndNotify(updates);
                if (applyThemeChange) {
                    setTheme(themeToApply); // Apply theme immediately to settings page
                    // *** Specific theme message removed here ***
                }
                updatePreview();
            });
            return; // Exit early as saving is handled in the async callback

        }
        // Logic when changing *AWAY* from "newline"
        else {
            // Check the *previous* value (needs to be read before saving newValue)
            chrome.storage.local.get(["streamTitleDisplay", "darkMode", "showStreamTime"], function (currentData) {
                const previousTitleDisplay = currentData.streamTitleDisplay || 'hover';
                if (previousTitleDisplay === "newline") {
                    console.log("Changing away from newline display. Resetting Stream Time and potentially theme.");
                    // Reset stream time to default (off)
                    updates.showStreamTime = "off";
                    updateDropdownUI('showStreamTimeSelect', 'off');

                    // If theme was verydark, reset to dark
                    const currentTheme = currentData.darkMode || 'dark';
                    if (currentTheme === "verydark") {
                        updates.darkMode = "dark";
                        updateDropdownUI('themeSelect', 'dark');
                        applyThemeChange = true;
                        themeToApply = 'dark';
                    }
                }
                // Save potentially modified updates. saveSettingsAndNotify will send oauthComplete
                saveSettingsAndNotify(updates);
                if (applyThemeChange) {
                    setTheme(themeToApply); // Apply theme immediately to settings page
                    // *** Specific theme message removed here ***
                }
                updatePreview();
            });
            return; // Exit early, saving handled in async callback
        }
    } else if (storageKey === "darkMode") {
        // Apply theme change immediately for the theme dropdown
        applyThemeChange = true;
        themeToApply = newValue;
    }

    // --- Save Settings (for non-async cases or after async logic completes) ---
    // saveSettingsAndNotify sends the 'oauthComplete' message
    saveSettingsAndNotify(updates);

    // Apply theme change to the current settings page immediately if needed
    if (applyThemeChange) {
        setTheme(themeToApply);
    }

    // *** Block sending specific theme update message removed here ***

    // Update preview for most changes
    updatePreview();
}

/**
* Adjusts dropdown position to prevent overflow.
* @param {HTMLElement} container - The dropdown container.
* @param {HTMLElement} optionsList - The element containing the options.
* @param {HTMLElement} header - The dropdown header element.
*/
function adjustDropdownPosition(container, optionsList, header) {
    const containerRect = container.getBoundingClientRect();
    const optionsHeight = optionsList.offsetHeight;
    const spaceBelow = window.innerHeight - containerRect.bottom;
    const spaceAbove = containerRect.top; // Space above the top of the container

    // Reset position styles
    optionsList.style.top = '';
    optionsList.style.bottom = '';

    // Check if it overflows below
    if (spaceBelow < optionsHeight && spaceAbove > optionsHeight) {
        // Not enough space below, but enough space above: Position above header
        optionsList.style.bottom = `${header.offsetHeight}px`; // Place bottom edge just above header
        // console.log(`Adjusting ${container.id || 'dropdown'} position: UP`);
    } else {
        // Default: Position below header
        optionsList.style.top = '100%';
        // console.log(`Adjusting ${container.id || 'dropdown'} position: DOWN (default)`);
    }
}


/**
* Updates the UI of a custom dropdown and its original select element.
* @param {string} selectId - The ID of the original select element.
* @param {string} value - The value to set.
*/
function updateDropdownUI(selectId, value) {
    const originalSelect = document.getElementById(selectId);
    const selectContainer = originalSelect?.closest('.custom-select-container');
    if (!originalSelect || !selectContainer) {
        console.error(`Cannot update UI for non-existent select: ${selectId}`);
        return;
    }

    const selectedTextElement = selectContainer.querySelector('.selected-option');
    const options = selectContainer.querySelectorAll('.custom-option');

    // Update original select
    originalSelect.value = value;

    // Update custom dropdown UI
    let foundOptionText = '';
    options.forEach(opt => {
        const isSelected = opt.dataset.value === value;
        opt.classList.toggle('selected', isSelected);
        if (isSelected) {
            foundOptionText = getCleanOptionText(opt); // Get text without dot
        }
    });

    if (selectedTextElement) {
        selectedTextElement.textContent = foundOptionText || value; // Fallback to value if text not found
    } else {
        console.warn(`Selected option text element not found for ${selectId}`);
    }

    // Trigger change event on original select (useful if other listeners depend on it)
    originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
}


/**
* Gets the clean text content of a dropdown option, excluding the dot span.
* @param {HTMLElement} optionElement - The .custom-option element.
* @returns {string} The clean text content.
*/
function getCleanOptionText(optionElement) {
    return Array.from(optionElement.childNodes)
        .filter(node => !(node.nodeType === 1 && node.classList.contains('option-dot')))
        .map(node => node.textContent.trim())
        .join('')
        .trim();
}

/**
* Enables or disables the Stream Title Display dropdown based on avatar visibility.
* Applies/removes a '.disabled' class for styling and interaction control.
* @param {boolean} isAvatarEnabled - Whether the avatar/thumbnail is enabled (checkbox is checked).
*/
function updateTitleDisplayDropdownState(isAvatarEnabled) {
    const titleDisplaySelect = document.getElementById('streamTitleDisplaySelect');
    // Find the parent container div of the custom dropdown
    const titleDisplayContainer = titleDisplaySelect?.closest('.custom-select-container');

    if (titleDisplayContainer) {
        const header = titleDisplayContainer.querySelector('.custom-select-header');

        // Add '.disabled' class when avatar is NOT enabled (isChecked is false)
        // Remove '.disabled' class when avatar IS enabled (isChecked is true)
        titleDisplayContainer.classList.toggle('disabled', !isAvatarEnabled);

        if (header) {
            // Set ARIA attribute for accessibility readers
            header.setAttribute('aria-disabled', String(!isAvatarEnabled));
            // NOTE: Your CSS needs rules for `.custom-select-container.disabled`
            // and potentially `.custom-select-container.disabled .custom-select-header`
            // to visually grey it out and set pointer-events: none; cursor: not-allowed;
        }

        // If the dropdown is being disabled, make sure it's closed
        if (!isAvatarEnabled) {
            titleDisplayContainer.classList.remove('open');
        }
    } else {
        // This warning is helpful during development
        console.warn("Stream Title Display dropdown container not found for state update.");
    }
}

// ==================================
// PREVIEW CREATION LOGIC - MODULARIZED BY MODE
// ==================================

let previewUpdateTimeout = null;

/** Cleans up any running timers associated with the preview container */
function clearPreviewTimers(container) {
    if (!container) return;
    const timers = container.querySelectorAll('[data-timer-id]');
    timers.forEach(el => {
        const timerId = parseInt(el.dataset.timerId, 10);
        if (!isNaN(timerId)) {
            clearInterval(timerId);
            // Optional: remove the attribute after clearing
            delete el.dataset.timerId;
        }
    });
}

/**
 * Builds the preview DOM elements for the 'Hover' mode WITH Avatar/Thumbnail visible.
 * @param {HTMLElement} previewDiv - The main container div to append elements to.
 * @param {object} stream - The stream data object.
 * @param {object} options - Preview options { showStreamTime }.
 */
function buildPreview_HoverWithAvatar(previewDiv, stream, options) {
    let timerId = null;

    // 1. Avatar
    if (stream.avatar) {
        const avatarImg = document.createElement("img");
        avatarImg.src = stream.avatar;
        avatarImg.alt = `${stream.channelName} avatar`;
        avatarImg.className = "stream-avatar";
        previewDiv.appendChild(avatarImg);
    }

    // 2. Info Wrapper (Name, Category)
    const infoWrapper = document.createElement("div");
    infoWrapper.className = "info-wrapper hover-mode"; // Explicitly hover-mode

    const channelNameSpan = document.createElement("span");
    channelNameSpan.textContent = stream.channelName;
    channelNameSpan.className = "channel-name hover-mode channel-name-with-avatar"; // Hover + Avatar classes
    infoWrapper.appendChild(channelNameSpan);

    if (stream.category) {
        const categoryDiv = document.createElement("div");
        categoryDiv.className = "stream-category"; // Category below name
        categoryDiv.textContent = stream.category;
        infoWrapper.appendChild(categoryDiv);
    }
    previewDiv.appendChild(infoWrapper);

    // 3. Right Wrapper (Time, Viewers, Signal)
    const viewersWrapper = document.createElement("div");
    viewersWrapper.className = "viewers-wrapper default-mode"; // Positioning for hover

    const viewersSpan = document.createElement("span");
    viewersSpan.className = "viewers-count";
    let viewersSpanContentAdded = false;

    // Prepend Time
    if (options.showStreamTime && stream.started_at) {
        const timeSpan = document.createElement("span");
        timeSpan.className = "stream-time";
        timeSpan.textContent = formatStreamTime(stream.started_at); // Use global util
        viewersSpan.appendChild(timeSpan);

        timerId = setInterval(() => {
            if (timeSpan && timeSpan.isConnected) {
                timeSpan.textContent = formatStreamTime(stream.started_at);
            } else {
                clearInterval(timerId);
            }
        }, 1000);
        timeSpan.dataset.timerId = timerId; // Store timer ID

        viewersSpan.appendChild(document.createTextNode(` `)); // Space
        viewersSpanContentAdded = true;
    }

    // Append Viewer Count
    if (stream.viewers !== undefined && stream.viewers !== null) {
        viewersSpan.appendChild(document.createTextNode(`${formatViewerCount(stream.viewers)} `)); // Use global util
        viewersSpanContentAdded = true;
    }

    // Append Signal Icon
    const signalIconSpan = document.createElement("span");
    signalIconSpan.className = "signal-icon"; // Default signal icon
    const signalIconImg = document.createElement("img");
    signalIconImg.src = "../../css/signal.svg";
    signalIconImg.alt = "Live signal";
    signalIconSpan.appendChild(signalIconImg);
    viewersSpan.appendChild(signalIconSpan);
    viewersSpanContentAdded = true;

    // Only append if content was added
    if (viewersSpanContentAdded) {
        viewersWrapper.appendChild(viewersSpan);
        previewDiv.appendChild(viewersWrapper);
    }
}

/**
 * Builds the preview DOM elements for the 'Hover' mode WITHOUT Avatar/Thumbnail visible.
 * @param {HTMLElement} previewDiv - The main container div to append elements to.
 * @param {object} stream - The stream data object.
 * @param {object} options - Preview options { showStreamTime }.
 */
function buildPreview_HoverWithoutAvatar(previewDiv, stream, options) {
    let timerId = null;

    // 1. Avatar - NONE

    // 2. Info Wrapper (Name only)
    const infoWrapper = document.createElement("div");
    infoWrapper.className = "info-wrapper hover-mode";

    const channelNameSpan = document.createElement("span");
    channelNameSpan.textContent = stream.channelName;
    channelNameSpan.className = "channel-name hover-mode"; // NO channel-name-with-avatar
    infoWrapper.appendChild(channelNameSpan);
    previewDiv.appendChild(infoWrapper);

    // 3. Right Wrapper (Category, Time, Viewers) - NO Signal Icon
    const viewersWrapper = document.createElement("div");
    viewersWrapper.className = "viewers-wrapper default-mode";
    let contentAdded = false;

    // Category comes first here
    if (stream.category) {
        const categoryDiv = document.createElement("div");
        categoryDiv.className = `stream-category no-avatar ${options.showStreamTime ? 'with-time' : 'without-time'}`;
        categoryDiv.textContent = stream.category;
        viewersWrapper.appendChild(categoryDiv);
        contentAdded = true;
    }

    // Viewers span holds Time + Count
    const viewersSpan = document.createElement("span");
    viewersSpan.className = "viewers-count"; // Still use this class for styling consistency if needed
    let viewersSpanContentAdded = false;

    // Prepend Time
    if (options.showStreamTime && stream.started_at) {
        const timeSpan = document.createElement("span");
        timeSpan.className = "stream-time";
        timeSpan.textContent = formatStreamTime(stream.started_at); // Use global util
        viewersSpan.appendChild(timeSpan);

        timerId = setInterval(() => {
            if (timeSpan && timeSpan.isConnected) {
                timeSpan.textContent = formatStreamTime(stream.started_at);
            } else {
                clearInterval(timerId);
            }
        }, 1000);
        timeSpan.dataset.timerId = timerId; // Store timer ID

        viewersSpan.appendChild(document.createTextNode(` `)); // Space
        viewersSpanContentAdded = true;
    }

    // Append Viewer Count
    if (stream.viewers !== undefined && stream.viewers !== null) {
        // Add a leading space if time wasn't shown but category was
        if (!options.showStreamTime && contentAdded && !viewersSpanContentAdded) {
            viewersSpan.appendChild(document.createTextNode(` `));
        }
        viewersSpan.appendChild(document.createTextNode(`${formatViewerCount(stream.viewers)} `)); // Use global util
        viewersSpanContentAdded = true;
    }

    // Append viewersSpan only if it has content
    if (viewersSpanContentAdded) {
        viewersWrapper.appendChild(viewersSpan);
        contentAdded = true; // Mark that the main wrapper has content
    }

    // Only append the wrapper if it has *any* content
    if (contentAdded) {
        previewDiv.appendChild(viewersWrapper);
    }
}

/**
 * Builds the preview DOM elements for the 'Newline' mode (Thumbnail layout).
 * Assumes showAvatar is true for this mode to be selected by the router.
 * @param {HTMLElement} previewDiv - The main container div to append elements to.
 * @param {object} stream - The stream data object.
 * @param {object} options - Preview options { showStreamTime }.
 */
function buildPreview_Newline(previewDiv, stream, options) {
    let timerId = null;

    // 1. Thumbnail
    if (stream.thumbnail) {
        const thumbnailWrapper = document.createElement("div");
        thumbnailWrapper.className = "thumbnail-wrapper";

        const thumbnailImg = document.createElement("img");
        thumbnailImg.className = "stream-thumbnail";
        thumbnailImg.src = "../../css/icon.png"; // Placeholder

        const actualImage = new Image();
        actualImage.onload = () => { thumbnailImg.src = stream.thumbnail.replace('{width}', '80').replace('{height}', '45'); };
        actualImage.onerror = () => { thumbnailImg.src = "../../css/icon.png"; }; // Fallback
        actualImage.src = stream.thumbnail.replace('{width}', '80').replace('{height}', '45');

        thumbnailWrapper.appendChild(thumbnailImg);

        // Time Overlay on Thumbnail
        if (options.showStreamTime && stream.started_at) {
            const timeOverlay = document.createElement("div");
            timeOverlay.className = "stream-time-overlay";
            timeOverlay.textContent = formatStreamTime(stream.started_at); // Use global util
            thumbnailWrapper.appendChild(timeOverlay);

            timerId = setInterval(() => {
                if (timeOverlay && timeOverlay.isConnected) {
                    timeOverlay.textContent = formatStreamTime(stream.started_at);
                } else {
                    clearInterval(timerId);
                }
            }, 1000);
            timeOverlay.dataset.timerId = timerId; // Store timer ID
        }
        previewDiv.appendChild(thumbnailWrapper);
    }
    // Note: If stream.thumbnail is missing, newline mode might look odd without a left element.
    // Could add a placeholder or fallback to avatar logic if needed.

    // 2. Info Wrapper (Name, Title, Category)
    const infoWrapper = document.createElement("div");
    infoWrapper.className = "info-wrapper newline-mode"; // Explicitly newline-mode

    const channelNameSpan = document.createElement("span");
    channelNameSpan.textContent = stream.channelName;
    channelNameSpan.className = "channel-name newline-mode channel-name-with-avatar"; // Newline + Avatar classes
    infoWrapper.appendChild(channelNameSpan);

    if (stream.title) {
        const titleDiv = document.createElement("div");
        titleDiv.className = "stream-title";
        titleDiv.textContent = stream.title;
        infoWrapper.appendChild(titleDiv);
    }

    if (stream.category) {
        const categoryDiv = document.createElement("div");
        categoryDiv.className = "stream-category-newline";
        categoryDiv.textContent = stream.category;
        infoWrapper.appendChild(categoryDiv);
    }
    previewDiv.appendChild(infoWrapper);

    // 3. Right Wrapper (Viewers, Signal Icon)
    const viewersWrapper = document.createElement("div");
    viewersWrapper.className = "viewers-wrapper newline-mode"; // Positioning for newline

    const viewersSpan = document.createElement("span");
    viewersSpan.className = "viewers-count"; // For styling consistency
    let viewersSpanContentAdded = false;

    // Viewer Count
    if (stream.viewers !== undefined && stream.viewers !== null) {
        viewersSpan.appendChild(document.createTextNode(`${formatViewerCount(stream.viewers)} `)); // Use global util
        viewersSpanContentAdded = true;
    }

    // Signal Icon
    const signalIconSpan = document.createElement("span");
    signalIconSpan.className = "signal-icon signal-icon-newline"; // Newline specific signal icon styling
    const signalIconImg = document.createElement("img");
    signalIconImg.src = "../../css/signal-newline.svg"; // Specific newline icon
    signalIconImg.alt = "Live signal";
    signalIconSpan.appendChild(signalIconImg);
    viewersSpan.appendChild(signalIconSpan);
    viewersSpanContentAdded = true; // Icon counts as content

    // Append if content exists
    if (viewersSpanContentAdded) {
        viewersWrapper.appendChild(viewersSpan);
        previewDiv.appendChild(viewersWrapper);
    }
}

/**
 * Creates the main preview element and routes to the correct builder function based on options.
 * @param {object} stream - The stream data object.
 * @param {object} options - Preview options { showAvatar, mode, showStreamTime }.
 * @returns {HTMLElement} The complete preview div element.
 */
function createPreviewElement(stream, options) {
    const previewDiv = document.createElement("div");

    // Set base class + mode class determined by streamTitleDisplay ('hover' or 'newline')
    previewDiv.className = `stream-preview ${options.mode === "newline" ? "newline-mode" : "hover-mode"}`;

    // Route to the appropriate builder function
    if (options.mode === "newline" && options.showAvatar) {
        // --- Newline/Thumbnail Mode ---
        buildPreview_Newline(previewDiv, stream, options);
    } else if (options.mode !== "newline" && options.showAvatar) {
        // --- Hover Mode WITH Avatar ---
        buildPreview_HoverWithAvatar(previewDiv, stream, options);
    } else {
        // --- Hover Mode WITHOUT Avatar ---
        // (Also catches newline mode when showAvatar is false, defaulting to no-avatar layout)
        buildPreview_HoverWithoutAvatar(previewDiv, stream, options);
    }

    return previewDiv;
}

/**
* Updates the preview pane based on current settings and a random live stream.
* (This function remains largely the same, just calls the new createPreviewElement router)
*/
function updatePreview() {
    clearTimeout(previewUpdateTimeout);
    previewUpdateTimeout = setTimeout(() => {
        chrome.storage.local.get(
            ["liveStreams", "streamTitleDisplay", "showStreamTime", "showAvatar"],
            (data) => {
                const liveStreams = data.liveStreams || [];
                const previewContainer = document.getElementById("previewContainer");

                if (!previewContainer) {
                    console.error("Preview container not found!");
                    return;
                }

                // Clear previous preview and its timers FIRST
                clearPreviewTimers(previewContainer);
                previewContainer.innerHTML = '';
                previewContainer.style.display = "none";

                // Determine preview options
                const options = {
                    showAvatar: data.showAvatar !== undefined ? data.showAvatar : true,
                    mode: data.streamTitleDisplay || "hover", // 'hover' or 'newline'
                    showStreamTime: data.showStreamTime === "on"
                };

                // Ensure checkbox reflects stored state (redundancy for safety)
                const avatarCheckbox = document.getElementById("showAvatarCheckbox");
                if (avatarCheckbox && avatarCheckbox.checked !== options.showAvatar) {
                    avatarCheckbox.checked = options.showAvatar;
                    updateTitleDisplayDropdownState(options.showAvatar); // Ensure dropdown state matches
                }


                if (liveStreams.length > 0) {
                    const previewStream = liveStreams[Math.floor(Math.random() * liveStreams.length)];
                    if (!previewStream) return;

                    // Create the preview element using the ROUTER function
                    const previewElement = createPreviewElement(previewStream, options); // Use the router
                    previewContainer.appendChild(previewElement);
                    previewContainer.style.display = "flex";

                    // Timers are handled within the builder functions now
                } else {
                    // Optional: Display a "no live streams" message
                    // previewContainer.textContent = "No followed streams currently live.";
                    // previewContainer.style.display = "block";
                }
            }
        );
    }, 100); // Debounce
}

// ==================================
// END OF PREVIEW CREATION LOGIC
// ==================================

/**
 * Intelligently waits for live streams data to be available before updating the preview.
 * Uses polling with exponential backoff instead of a fixed delay.
 */
function waitForLiveStreamsAndUpdatePreview() {
    console.log("Waiting for live streams data before updating preview...");

    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    const INITIAL_DELAY_MS = 200;

    function checkAndUpdate() {
        attempts++;

        chrome.storage.local.get("liveStreams", (data) => {
            const liveStreams = data.liveStreams || [];

            if (liveStreams.length > 0) {
                // Data is available, update the preview
                console.log(`Live streams data found (${liveStreams.length} streams). Updating preview...`);
                updatePreview();
            } else if (attempts < MAX_ATTEMPTS) {
                // Data not available yet, try again with exponential backoff
                const delay = INITIAL_DELAY_MS * Math.pow(1.5, attempts);
                console.log(`No live streams data yet. Retry ${attempts}/${MAX_ATTEMPTS} in ${delay}ms...`);
                setTimeout(checkAndUpdate, delay);
            } else {
                // Give up after max attempts
                console.warn(`No live streams found after ${MAX_ATTEMPTS} attempts. Updating preview anyway...`);
                updatePreview();
            }
        });
    }

    // Start the checking process
    checkAndUpdate();
}

/**
 * Initializes the Display Settings section and the Preview Pane.
 * Sets up initial states and event listeners for display options and toggles.
 */
function initializeDisplaySection() {
    console.log("Initializing Display Settings Section...");
    // Call the setup functions that were moved here
    setupGeneralSettings(); // Sets up Avatar/Accessed Count toggles and initial state
    setupDisplayOptions();  // Sets up the dropdowns and their initial state/listeners
    updatePreview();      // Perform initial render of the preview pane
    console.log("Display Settings Section Initialized.");
}