function displayGroups() {
    chrome.storage.local.get('favoriteGroups', function(data) {
        var groups = data.favoriteGroups || [];
        var groupListContainer = document.getElementById('groupListContainer');
        var favoriteListText = document.getElementById('favoriteListText');

        groupListContainer.innerHTML = '';

        if (groups.length === 0) {
            groupListContainer.innerHTML = `
                <p style="font-size: 16px;">
                    <img src="css/nogroup.gif">
                    <strong>No Favorite Groups Created Yet</strong><br>
                    This is a list that will help you filter your favorite live streams from the popup into new category groups. 
                    You can create a group and add any Twitch channel to it, organizing your streams for easy access.
                </p>`;
            favoriteListText.style.display = 'none';
        } else {
            favoriteListText.style.display = 'block';

            var groupList = document.createElement('ul');
            groupList.id = 'groupList';

            groups.forEach(function(group, index) {
                var groupItem = document.createElement('li');
                groupItem.classList.add('group-item');

                var groupNameSpan = document.createElement('span');
                groupNameSpan.textContent = group.name;
                groupItem.appendChild(groupNameSpan);

                // Create the first column of streamers
                var streamersList = document.createElement('ul');
                streamersList.classList.add('streamers-list');
                streamersList.style.listStyleType = 'none';
                streamersList.style.padding = '0';

                group.streamers.forEach(function(streamer, streamerIndex) {
                    var streamerItem = document.createElement('li');
                    streamerItem.style.display = 'flex';
                    streamerItem.style.justifyContent = 'space-between';
                    streamerItem.style.alignItems = 'center';
                    streamerItem.style.fontSize = '70%';

                    // Add Twitch icon
                    var twitchIcon = document.createElement('img');
                    twitchIcon.src = 'css/twitch.png'; // Update with the correct path
                    twitchIcon.alt = 'Twitch';
                    twitchIcon.style.width = '20px'; // Adjust size as needed
                    twitchIcon.style.marginRight = '3px';
                    streamerItem.appendChild(twitchIcon);

                    var streamerNameSpan = document.createElement('span');
                    streamerNameSpan.textContent = streamer;
                    streamerNameSpan.style.flexGrow = '1';
                    streamerItem.appendChild(streamerNameSpan);

                    var deleteStreamerBtn = document.createElement('button');
                    deleteStreamerBtn.textContent = 'x';
                    deleteStreamerBtn.style.width = '30px';
                    deleteStreamerBtn.onclick = function() {
                        deleteStreamer(index, streamerIndex);
                    };
                    streamerItem.appendChild(deleteStreamerBtn);

                    // Append streamer item to the current list
                    streamersList.appendChild(streamerItem);

                    // If 5 streamers have been added or we reach the end, append the list and start a new one
                    if ((streamerIndex % 5 === 4 && streamerIndex !== 0) || streamerIndex === group.streamers.length - 1) {
                        groupItem.appendChild(streamersList);
                        streamersList = document.createElement('ul');
                        streamersList.classList.add('streamers-list');
                        streamersList.style.listStyleType = 'none';
                        streamersList.style.padding = '0';
                    }
                });

                var buttonContainer = document.createElement('div');
                buttonContainer.classList.add('button-container');

                var addStreamerBtn = document.createElement('button');
                addStreamerBtn.textContent = '➕ add a Twitch Channel';
                addStreamerBtn.onclick = function() {
                    showAddStreamerDropdown(index);
                };
                buttonContainer.appendChild(addStreamerBtn);

                var deleteBtn = document.createElement('button');
                deleteBtn.textContent = '❌ Delete this list';
                deleteBtn.onclick = function() {
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
    chrome.storage.local.get('favoriteGroups', function(data) {
        var groups = data.favoriteGroups || [];
        if (groups[groupIndex] && groups[groupIndex].streamers[streamerIndex] != null) {
            groups[groupIndex].streamers.splice(streamerIndex, 1);

            chrome.storage.local.set({ 'favoriteGroups': groups }, function() {
                console.log('Streamer deleted');
                displayGroups();
            });
        }
    });
}

// Global function to delete a group
function deleteGroup(index) {
    chrome.storage.local.get('favoriteGroups', function(data) {
        var groups = data.favoriteGroups || [];
        groups.splice(index, 1);

        chrome.storage.local.set({ 'favoriteGroups': groups }, function() {
            console.log('Group deleted');
            displayGroups();
        });
    });
}

// Global function to get the followed list
function getFollowedList() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('followedList', function(data) {
            if (data.followedList) {
                resolve(data.followedList);
            } else {
                reject('No followed list found');
            }
        });
    });
}

// Global function to show the streamer dropdown
function showAddStreamerDropdown(groupIndex) {
    getFollowedList().then(followedList => {
        var existingDropdown = document.querySelector('.dropdown-menu');
        var existingOverlay = document.getElementById('dropdownOverlay');
        if (existingDropdown) {
            existingDropdown.remove();
        }
        if (existingOverlay) {
            existingOverlay.remove();
        }

        var overlay = document.createElement('div');
        overlay.id = 'dropdownOverlay';
        overlay.style.position = 'fixed';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '2';

        var dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'dropdown-menu';

        var searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search streamer...';
        searchInput.style.width = '91%';
        searchInput.onkeyup = function() {
            var searchValue = this.value.toLowerCase();
            filterDropdown(dropdownMenu, searchValue);
        };
        dropdownMenu.appendChild(searchInput);

        followedList.forEach(function(channel) {
            var dropdownItem = document.createElement('a');
            dropdownItem.textContent = channel.broadcaster_name;
            dropdownItem.onclick = function() {
                chrome.storage.local.get('favoriteGroups', function(data) {
                    var groups = data.favoriteGroups || [];
                    if (groups[groupIndex]) {
                        groups[groupIndex].streamers.push(channel.broadcaster_name);

                        chrome.storage.local.set({ 'favoriteGroups': groups }, function() {
                            console.log('Streamer added:', channel.broadcaster_name, 'to group', groups[groupIndex].name);
                            displayGroups();
                        });
                    }
                });
            };
            dropdownMenu.appendChild(dropdownItem);
        });

        document.body.appendChild(overlay);
        document.body.appendChild(dropdownMenu);
        dropdownMenu.style.display = 'block';

        dropdownMenu.style.width = '300px';
        dropdownMenu.style.position = 'absolute';
        dropdownMenu.style.overflowY = 'auto';
        dropdownMenu.style.maxHeight = '400px';

        var screenWidth = window.innerWidth;
        var dropdownWidth = dropdownMenu.offsetWidth;
        var leftPosition = (screenWidth - dropdownWidth) / 2;
        dropdownMenu.style.left = `${leftPosition}px`;
        dropdownMenu.style.top = '50px';
        dropdownMenu.style.zIndex = '3';

        function closeDropdown(event) {
            if (!dropdownMenu.contains(event.target) && !searchInput.contains(event.target)) {
                dropdownMenu.style.display = 'none';
                overlay.style.display = 'none';
                document.removeEventListener('click', closeDropdown);
            }
        }

        setTimeout(() => {
            document.addEventListener('click', closeDropdown);
        }, 0);
    }).catch(error => {
        console.error(error);
    });
}


// Global function to filter dropdown
function filterDropdown(dropdownMenu, searchValue) {
    var dropdownItems = dropdownMenu.getElementsByTagName('a');
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
document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById("myModal");
    var btn = document.getElementById("addFavoriteGroupButton");
    var span = document.getElementsByClassName("close")[0];
    var saveButton = document.getElementById("saveGroup");

    btn.onclick = function() {
        modal.style.display = "block";
    };

    span.onclick = function() {
        modal.style.display = "none";
    };

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };

    saveButton.addEventListener('click', function() {
        var groupName = document.getElementById("groupName").value;
        if (groupName) {
            chrome.storage.local.get('favoriteGroups', function(data) {
                var groups = data.favoriteGroups || [];
                var newGroup = { name: groupName, streamers: [] };
                groups.push(newGroup);

                chrome.storage.local.set({ 'favoriteGroups': groups }, function() {
                    console.log('Group saved:', groupName);
                    modal.style.display = "none";
                    displayGroups();
                });
            });
        } else {
            console.log('No group name entered');
        }
    });

    displayGroups();
});
