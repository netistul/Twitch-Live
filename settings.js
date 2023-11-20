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
        chrome.storage.local.set({ 'favoriteGroupName': groupName }, function() {
          console.log('Group saved:', groupName);
          modal.style.display = "none"; // Close the modal after saving
        });
      } else {
        console.log('No group name entered');
      }
    });

      // Function to display saved groups
      function displayGroups() {
        chrome.storage.local.get('favoriteGroups', function(data) {
          var groups = data.favoriteGroups || [];
          var groupListContainer = document.getElementById('groupListContainer');
          var favoriteListText = document.getElementById('favoriteListText'); // Reference to the text element
      
          groupListContainer.innerHTML = ''; // Clear existing content
      
          if (groups.length === 0) {
            // Display an informative message if the list is empty
            groupListContainer.innerHTML = `
              <p style="font-size: 16px;">
                <img src="css/nogroup.gif">
                <strong>No Favorite Groups Created Yet</strong><br>
                This is a list that will help you filter your favorite live streams from the popup into new category groups...
              </p>`;
            favoriteListText.style.display = 'none'; // Hide the descriptive text
          } else {
            favoriteListText.style.display = 'block'; // Show the descriptive text
      
            // Create and append groups list
            var groupList = document.createElement('ul');
            groupList.id = 'groupList';
    
                groups.forEach(function(group, index) {
                    var li = document.createElement('li');
                    li.textContent = group;
                  
                    // Add Streamer button
                    var addStreamerBtn = document.createElement('button');
                    addStreamerBtn.textContent = '➕ add a Twitch Channel to this list';
                    addStreamerBtn.style.backgroundColor = '#44c767'; // Set green background color
                    addStreamerBtn.style.color = 'white'; // Set text color to white
                    addStreamerBtn.style.padding = '4px 10px';
                    addStreamerBtn.style.border = 'none';
                    addStreamerBtn.style.borderRadius = '3px';
                    addStreamerBtn.style.cursor = 'pointer';
                    addStreamerBtn.style.transition = 'background-color 0.3s ease';
                  
                    // Add hover effect with a lighter green color
                    addStreamerBtn.addEventListener('mouseenter', function() {
                      addStreamerBtn.style.backgroundColor = '#28a745'; // Lighter green on hover
                    });
                  
                    // Reset to the original green color on mouse leave
                    addStreamerBtn.addEventListener('mouseleave', function() {
                      addStreamerBtn.style.backgroundColor = '#44c767'; // Original green color
                    });
                  
                    addStreamerBtn.onclick = function() {
                      showAddStreamerDropdown(index);
                    };
                    li.appendChild(addStreamerBtn);
                  
                  
 // Delete button
var deleteBtn = document.createElement('button');
deleteBtn.textContent = 'Delete';
deleteBtn.className = 'delete-button'; // Add the 'delete-button' class for styling
deleteBtn.style.backgroundColor = '#ff4c4c'; // Set red background color
deleteBtn.style.color = 'white'; // Set text color to white
deleteBtn.style.padding = '3px 10px';
deleteBtn.style.border = 'none';
deleteBtn.style.borderRadius = '3px';
deleteBtn.style.cursor = 'pointer';
deleteBtn.style.transition = 'background-color 0.3s ease';

// Add hover effect with a slightly darker red color
deleteBtn.addEventListener('mouseenter', function() {
  deleteBtn.style.backgroundColor = '#ff3333'; // Slightly darker red on hover
});

// Reset to the original red color on mouse leave
deleteBtn.addEventListener('mouseleave', function() {
  deleteBtn.style.backgroundColor = '#ff4c4c'; // Original red color
});

deleteBtn.onclick = function() {
  deleteGroup(index);
  displayGroups(); // Refresh the list after deletion
};

li.appendChild(deleteBtn);
groupList.appendChild(li);

                  });
                  
                // Append the updated list to the container
                groupListContainer.appendChild(groupList);
            }
        });
    }
  // Function to delete a group
  function deleteGroup(index) {
    chrome.storage.local.get('favoriteGroups', function(data) {
      var groups = data.favoriteGroups || [];
      groups.splice(index, 1); // Remove the group at the specified index

      chrome.storage.local.set({ 'favoriteGroups': groups }, function() {
        console.log('Group deleted');
        displayGroups(); // Update the displayed list
      });
    });
  }

  // Call displayGroups to show the list on page load
  displayGroups();

  // Update saveButton event listener to handle multiple groups
  saveButton.addEventListener('click', function() {
    var groupName = document.getElementById("groupName").value;
    if (groupName) {
      chrome.storage.local.get('favoriteGroups', function(data) {
        var groups = data.favoriteGroups || [];
        groups.push(groupName);

        chrome.storage.local.set({ 'favoriteGroups': groups }, function() {
          console.log('Group saved:', groupName);
          modal.style.display = "none"; // Close the modal after saving
          displayGroups(); // Update the displayed list
        });
      });
    } else {
      console.log('No group name entered');
    }
  });
  });

  function getFollowedList() {
    // Fetch the followed list from local storage
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

  function showAddStreamerDropdown(groupIndex) {
    getFollowedList().then(followedList => {
        // Close any existing dropdown
        var existingDropdown = document.querySelector('.dropdown-menu');
        var existingOverlay = document.getElementById('dropdownOverlay');
        if (existingDropdown) {
            existingDropdown.remove();
        }
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Create overlay for the dropdown
        var overlay = document.createElement('div');
        overlay.id = 'dropdownOverlay';
        overlay.style.position = 'fixed';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '2';

        // Create dropdown menu container
        var dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'dropdown-menu';

        // Create search input
        var searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search streamer...';
        searchInput.style.width = '93%';
        searchInput.onkeyup = function() {
            var searchValue = this.value.toLowerCase();
            filterDropdown(dropdownMenu, searchValue);
        };
        dropdownMenu.appendChild(searchInput);

        // Create dropdown items
        followedList.forEach(function(channel) {
            var dropdownItem = document.createElement('a');
            dropdownItem.href = '#';
            dropdownItem.textContent = channel.broadcaster_name;
            dropdownItem.onclick = function() {
                console.log('Adding', channel.broadcaster_name, 'to group', groupIndex);
                // Add logic to add streamer to group here
            };
            dropdownMenu.appendChild(dropdownItem);
        });

        // Append the overlay and dropdown to the body
        document.body.appendChild(overlay);
        document.body.appendChild(dropdownMenu);
        dropdownMenu.style.display = 'block';
    
        // Set width, position, and height of dropdown
        dropdownMenu.style.width = '300px'; // Set width
        dropdownMenu.style.position = 'absolute';
        dropdownMenu.style.overflowY = 'auto'; // Enable scroll for overflow
        dropdownMenu.style.maxHeight = '400px'; // Increase max height to accommodate 10 items
    
        // Center the dropdown
        var screenWidth = window.innerWidth;
        var dropdownWidth = dropdownMenu.offsetWidth;
        var leftPosition = (screenWidth - dropdownWidth) / 2;
        dropdownMenu.style.left = `${leftPosition}px`; // Center horizontally
        dropdownMenu.style.top = '50px';
        dropdownMenu.style.zIndex = '3';

        // Function to close dropdown and overlay
        function closeDropdown(event) {
            if (!dropdownMenu.contains(event.target) && !searchInput.contains(event.target)) {
                dropdownMenu.style.display = 'none';
                overlay.style.display = 'none';
                document.removeEventListener('click', closeDropdown);
            }
        }
    
        // Close dropdown and overlay when clicking outside
        setTimeout(() => {
            document.addEventListener('click', closeDropdown);
        }, 0);
    }).catch(error => {
        console.error(error);
    });
}

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


