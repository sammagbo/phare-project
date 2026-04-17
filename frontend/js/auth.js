/**
 * auth.js
 * Core authentication logic for pHARe project using JWT & Refresh Tokens.
 */

const AUTH_KEY = 'phare_jwt_token';
const REFRESH_KEY = 'phare_refresh_token';
// Set the IP dynamically so tablets point back to the PC instead of themselves
const HOSTNAME = window.location.hostname || 'localhost';
const AUTH_API_URL = `http://${HOSTNAME}:3000/api/auth`; 

// Mutex to prevent multiple simultaneous refresh calls
let refreshingPromise = null;

/**
 * Log in the user by calling the backend API.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, message?: string}>} Authentication result.
 */
export const loginUser = async (email, password) => {
    try {
        const response = await fetch(`${AUTH_API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            const token = data.token;
            const refreshToken = data.refreshToken;

            if (token && refreshToken) {
                localStorage.setItem(AUTH_KEY, token);
                localStorage.setItem(REFRESH_KEY, refreshToken);
                return { success: true };
            } else {
                console.error("Authentication successful, but tokens are missing.");
                return { success: false, message: "Erreur serveur: tokens invalides." };
            }
        }
        
        let errorMessage = "Identifiants incorrects ou erreur serveur.";
        try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
                errorMessage = errorData.error;
            } else if (errorData && errorData.errors) {
                errorMessage = errorData.errors.map(e => e.msg).join(', ');
            }
        } catch (e) {
            // Response parsing failed
        }
        
        return { success: false, message: errorMessage };
    } catch (error) {
        console.error("Login request failed:", error);
        return { success: false, message: "Impossible de joindre le serveur de connexion." };
    }
};

/**
 * Remove session tokens and redirect to login.
 */
export const logoutUser = async () => {
    // Attempt to notify server to revoke refresh token
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const token = localStorage.getItem(AUTH_KEY);
    
    if (refreshToken && token) {
        try {
            await fetch(`${AUTH_API_URL}/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ refreshToken })
            });
        } catch (e) {
            console.warn("Could not reach backend to revoke token during logout.");
        }
    }

    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(REFRESH_KEY);
    
    const currentPath = window.location.pathname;
    if (!currentPath.endsWith('login.html')) {
        window.location.href = 'login.html';
    }
};

/**
 * Attempts to silently refresh the access token using the refresh token.
 * Mutex-protected to avoid race conditions on mobile.
 * @returns {Promise<string|null>} The new token if successful, null if failed.
 */
export const refreshAccessToken = async () => {
    // If a refresh is already in progress, return the existing promise
    if (refreshingPromise) {
        return refreshingPromise;
    }

    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;

    refreshingPromise = (async () => {
        try {
            const response = await fetch(`${AUTH_API_URL}/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    localStorage.setItem(AUTH_KEY, data.token);
                    return data.token;
                }
            }
            
            // If refresh fails, tokens are truly dead.
            console.error("Session expired or refresh token invalid. Logging out.");
            logoutUser();
            return null;
        } catch (err) {
            console.error(`Network error reaching auth server at ${AUTH_API_URL}:`, err);
            return null; 
        } finally {
            refreshingPromise = null;
        }
    })();

    return refreshingPromise;
};

/**
 * Check if the user is authenticated.
 */
export const checkAuth = () => {
    const token = localStorage.getItem(AUTH_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const isLoginPage = window.location.pathname.endsWith('login.html');

    if (!token && !refreshToken) {
        if (!isLoginPage) {
            window.location.href = 'login.html';
        }
        return false;
    }

    if (isLoginPage) {
        window.location.href = 'phare-gestion-harcelement.html';
    }

    return true;
};

export const getToken = () => localStorage.getItem(AUTH_KEY);

/**
 * Mobile/iPad optimization: Sync session when the app is foregrounded.
 */
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        const token = getToken();
        if (token) {
            console.log("App foregrounded. Verifying session integrity...");
            // Optional: call a lightweight 'me' or 'status' endpoint here
        }
    }
});
