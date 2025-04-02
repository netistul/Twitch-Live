// settings/user-settings.js
//
// --- Core Functionality: User Info & Auth ---

/**
* Fetches user info from storage and displays it, including login/logout controls.
*/
function displayUserInfo() {
    chrome.storage.local.get(
        ["userDisplayName", "userAvatar", "twitchAccessToken", "loginTipShown"],
        function (result) {
            const userInfoDiv = document.getElementById("userInfo");
            if (!userInfoDiv) return;

            userInfoDiv.innerHTML = ""; // Clear previous content

            if (!result.twitchAccessToken) {
                // --- Logged Out State ---
                const loginContainer = document.createElement("div");
                loginContainer.className = "login-container";

                const infoText = document.createElement("p");
                infoText.innerHTML = "Log in with Twitch to view channels you follow. <br><br> Enjoy real-time updates directly in the extension's popup, making sure you never miss a moment of your favorite streams!";
                loginContainer.appendChild(infoText);

                const loginButton = document.createElement("button");
                loginButton.id = "loginButton";
                loginButton.textContent = "Login with Twitch";
                loginButton.className = "login-button"; // Use classList.add if adding multiple
                loginButton.addEventListener("click", () => {
                    chrome.runtime.sendMessage({ action: "startOAuth" });
                });
                loginContainer.appendChild(loginButton);

                userInfoDiv.appendChild(loginContainer);

            } else if (result.userDisplayName && result.userAvatar) {
                // --- Logged In State ---
                userInfoDiv.innerHTML = `
                  <div id="userTable">
                    <div class="user-row">
                      <div class="user-cell">Logged in as:</div>
                      <div class="user-cell user-avatar-container" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" title="Account options">
                        <img src="${result.userAvatar}" alt="User Avatar" class="user-avatar">
                        <div class="logout-dropdown">
                          <button id="logoutButton" class="logout-button">
                            <img src="css/settings/logout.png" alt="" class="logout-icon"> Logout
                          </button>
                        </div>
                      </div>
                      <div class="user-cell user-display-name">${result.userDisplayName}</div>
                    </div>
                  </div>
                `;

                // --- Setup Logout Dropdown Interaction ---
                setupLogoutDropdown(userInfoDiv);

                // Show login tip only once after login
                if (!result.loginTipShown) {
                    showLoginTip(userInfoDiv); // Pass the container to append to
                    chrome.storage.local.set({ loginTipShown: true });
                }
            } else {
                // Fallback/Error state (e.g., token exists but no user data)
                userInfoDiv.textContent = "Logged in, but user data unavailable. Try logging out and back in.";
                const logoutButton = document.createElement('button');
                logoutButton.textContent = 'Logout';
                logoutButton.onclick = handleLogout; // Reuse logout logic
                userInfoDiv.appendChild(logoutButton);
            }
        }
    );
}

/** Sets up the event listeners for the logout dropdown menu */
function setupLogoutDropdown(userInfoDiv) {
    const avatarContainer = userInfoDiv.querySelector(".user-avatar-container");
    const dropdown = userInfoDiv.querySelector(".logout-dropdown");
    const logoutButton = userInfoDiv.querySelector("#logoutButton");

    if (!avatarContainer || !dropdown || !logoutButton) return;

    const toggleDropdown = (show) => {
        dropdown.classList.toggle("show", show);
        avatarContainer.setAttribute("aria-expanded", String(show));
    };

    avatarContainer.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleDropdown(!dropdown.classList.contains("show"));
    });

    avatarContainer.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleDropdown(!dropdown.classList.contains("show"));
        } else if (event.key === "Escape") {
            toggleDropdown(false);
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (event) => {
        if (!avatarContainer.contains(event.target)) {
            toggleDropdown(false);
        }
    }, true); // Use capture phase to potentially catch clicks sooner

    // Handle logout button click
    logoutButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleLogout();
        toggleDropdown(false); // Close dropdown after initiating logout
    });
}

/** Handles the logout process */
function handleLogout() {
    chrome.runtime.sendMessage(
        { action: "disconnectTwitch" },
        (response) => {
            if (response && response.status === "success") {
                // Reset tip shown state on logout
                chrome.storage.local.set({ loginTipShown: false }, () => {
                    window.location.reload(); // Reload page to reflect logged-out state
                });
            } else {
                console.error("Logout failed:", response);
                alert("Logout failed. Please try again.");
            }
        }
    );
}


/**
* Displays a temporary tip about pinning the extension.
* @param {HTMLElement} container - The element to append the tip to.
*/
function showLoginTip(container) {
    const existingTip = document.getElementById("loginTip");
    if (existingTip) existingTip.remove(); // Remove if already exists

    const tipContainer = document.createElement("div");
    tipContainer.id = "loginTip";
    tipContainer.style.cssText = `
        background-color: #6441a5; color: white; padding: 10px; border-radius: 5px;
        margin-top: 15px; display: flex; flex-direction: column; align-items: center;
        justify-content: center; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        font-family: 'Arial', sans-serif; transition: opacity 0.5s ease-out; opacity: 1;
    `;

    const tipText = document.createElement("span");
    tipText.textContent = "Pin the extension for easy access!";
    tipText.style.textAlign = "center";
    tipContainer.appendChild(tipText);

    const tipImage = document.createElement("img");
    tipImage.src = "css/settings/infopin.png";
    tipImage.alt = "Browser toolbar showing how to pin an extension.";
    tipImage.style.width = "250px";
    tipImage.style.marginTop = "5px";
    tipContainer.appendChild(tipImage);

    if (container) {
        container.appendChild(tipContainer);
    } else {
        // Fallback if container not provided (though it should be)
        document.body.appendChild(tipContainer);
    }


    // Auto-remove the tip
    setTimeout(() => {
        tipContainer.style.opacity = '0';
        tipContainer.addEventListener('transitionend', () => tipContainer.remove(), { once: true });
    }, 7000);
}

/**
 * Initializes the User Info section of the settings page.
 * Fetches and displays user data, sets up login/logout controls.
 */
function initializeUserSection() {
    console.log("Initializing User Section...");
    displayUserInfo(); // The main function to display user info and set up listeners
    console.log("User Section Initialized.");
}