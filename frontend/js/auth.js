/**
 * auth.js
 * The session of the pHARe frontend.
 *
 * - The refresh token lives only in the `phare_refresh` cookie, HttpOnly: no script reads it, this one included.
 * - The access token (15 min) lives only in memory, in this module: never in localStorage. Each protected page asks for
 *   one when it opens, through the refresh, with the cookie.
 * - Without a session the page goes to the login; the stored data is never shown before the session is confirmed.
 */

// Set the IP dynamically so tablets point back to the PC instead of themselves
const HOSTNAME = window.location.hostname || 'localhost';
const AUTH_API_URL = `http://${HOSTNAME}:3000/api/auth`;

export const UNREACHABLE_MESSAGE = 'Serveur de connexion injoignable. Réessayez plus tard.';
const UNREACHABLE_PARAM = 'injoignable';

// The keys of an older version, which kept both tokens in localStorage: they go as soon as a page loads
const LEGACY_TOKEN_KEYS = ['phare_jwt_token', 'phare_refresh_token'];
LEGACY_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));

let accessToken = null;
let refreshing = null; // one refresh at a time per page
let session = null; // the session check of the page, done once

const isLoginPage = () => window.location.pathname.endsWith('login.html');

/** POST to the auth service with the session cookie and a JSON body (the service refuses any other type). */
const postAuth = (route, body = {}) => fetch(`${AUTH_API_URL}/${route}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

/** Removes every pHARe entry from localStorage: the cases, the members, the meetings and the old token keys. */
export const clearLocalData = () => {
    Object.keys(localStorage)
        .filter((key) => key.startsWith('phare_'))
        .forEach((key) => localStorage.removeItem(key));
};

/** Leaves the page for the login: with the message when the auth service is unreachable. Never resolves. */
const goToLogin = (unreachable) => {
    window.location.replace(unreachable ? `login.html?erreur=${UNREACHABLE_PARAM}` : 'login.html');
    return new Promise(() => {});
};

/**
 * Log in the user by calling the backend API. The service sets the session cookie; the access token stays in memory.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, message?: string}>} Authentication result.
 */
export const loginUser = async (email, password) => {
    let response;
    try {
        response = await postAuth('login', { email, password });
    } catch (error) {
        console.warn('Login request failed: the auth service is unreachable.', error);
        return { success: false, message: UNREACHABLE_MESSAGE };
    }

    if (response.ok) {
        const data = await response.json();
        if (data.token) {
            accessToken = data.token;
            return { success: true };
        }
        console.error('Authentication successful, but the access token is missing.');
        return { success: false, message: 'Erreur serveur : réponse invalide.' };
    }

    let errorMessage = 'Identifiants incorrects ou erreur serveur.';
    try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
            errorMessage = errorData.error;
        } else if (errorData && errorData.errors) {
            errorMessage = errorData.errors.map((e) => e.msg).join(', ');
        }
    } catch (e) {
        // Response parsing failed
    }
    return { success: false, message: errorMessage };
};

/**
 * Asks the auth service for a new access token with the session cookie. One request at a time per page.
 * @returns {Promise<{token?: string, unreachable?: boolean}>} the token, or why there is none.
 */
export const refreshAccessToken = () => {
    if (!refreshing) {
        refreshing = (async () => {
            try {
                const response = await postAuth('refresh');
                if (response.ok) {
                    const data = await response.json();
                    if (data.token) {
                        accessToken = data.token;
                        return { token: data.token };
                    }
                }
                accessToken = null;
                return {};
            } catch (err) {
                console.warn(`Network error reaching auth server at ${AUTH_API_URL}:`, err);
                return { unreachable: true };
            } finally {
                refreshing = null;
            }
        })();
    }
    return refreshing;
};

/**
 * Ends the page's session after a failed refresh: on a 401 the stored data goes, then the login; when the auth
 * service is unreachable, the login with the message. Never resolves.
 */
export const endSession = ({ unreachable } = {}) => {
    accessToken = null;
    if (!unreachable) clearLocalData();
    return goToLogin(unreachable);
};

/**
 * The session check of a protected page, run when it opens: a refresh with the cookie. The page stays hidden until it
 * answers, so nothing stored shows up without a session. Resolves when the session is valid; otherwise leaves for the
 * login and never resolves.
 */
export const checkAuth = () => {
    if (isLoginPage()) return Promise.resolve(false);
    if (!session) {
        document.documentElement.style.visibility = 'hidden';
        session = refreshAccessToken().then((result) => {
            if (!result.token) return endSession(result);
            document.documentElement.style.visibility = '';
            return true;
        });
    }
    return session;
};

/** The access token of the page, once the session is confirmed. */
export const getAccessToken = async () => {
    await checkAuth();
    return accessToken;
};

/**
 * Logs out: always tells the auth service, which revokes the session and deletes the cookie, even without an access
 * token; then removes the pHARe data from localStorage and goes to the login.
 */
export const logoutUser = async () => {
    try {
        await postAuth('logout');
    } catch (e) {
        console.warn('Could not reach the auth service to revoke the session during logout.');
    }
    accessToken = null;
    clearLocalData();
    window.location.href = 'login.html';
};

/** The login page shows why the last page sent it there, when the auth service was unreachable. */
export const loginNotice = () => (
    new URLSearchParams(window.location.search).get('erreur') === UNREACHABLE_PARAM ? UNREACHABLE_MESSAGE : null
);
