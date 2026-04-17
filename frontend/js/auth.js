/**
 * auth.js
 * Core authentication logic for pHARe project.
 * For now, simulation using localStorage.
 */

const AUTH_KEY = 'phare_auth_session';

/**
 * Log in the user with mock credentials.
 * @param {string} email 
 * @param {string} password 
 * @returns {boolean}
 */
export const loginUser = (email, password) => {
    // Mock validation
    // Example credentials: admin@phare.fr / password123
    if (email === 'admin@phare.fr' && password === 'password123') {
        const session = {
            email,
            timestamp: Date.now(),
            status: 'authenticated'
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        return true;
    }
    return false;
};

/**
 * Remove session and redirect to login.
 */
export const logoutUser = () => {
    localStorage.removeItem(AUTH_KEY);
    // Determine the path to login.html relative to current page
    const currentPath = window.location.pathname;
    if (currentPath.includes('frontend/')) {
        window.location.href = 'login.html';
    } else {
        window.location.href = 'login.html';
    }
};

/**
 * Check if the user is authenticated.
 * Used for page protection.
 */
export const checkAuth = () => {
    const sessionStr = localStorage.getItem(AUTH_KEY);
    const isLoginPage = window.location.pathname.endsWith('login.html');

    if (!sessionStr) {
        if (!isLoginPage) {
            window.location.href = 'login.html';
        }
        return false;
    }

    try {
        const session = JSON.parse(sessionStr);
        // We could add an expiry check here
        if (session.status !== 'authenticated') {
            if (!isLoginPage) window.location.href = 'login.html';
            return false;
        }
        return true;
    } catch (e) {
        if (!isLoginPage) window.location.href = 'login.html';
        return false;
    }
};

/**
 * Get current session data.
 */
export const getSession = () => {
    const sessionStr = localStorage.getItem(AUTH_KEY);
    return sessionStr ? JSON.parse(sessionStr) : null;
};
