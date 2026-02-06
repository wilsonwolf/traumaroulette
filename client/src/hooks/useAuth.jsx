/**
 * @file useAuth.jsx
 * @description Authentication context provider and consumer hook.
 *
 * Exposes a React Context that holds the current user object, loading state,
 * and action methods (register, login, logout, refreshUser). The provider
 * bootstraps authentication on mount by checking for an existing JWT in
 * sessionStorage and validating it via the `/auth/me` endpoint.
 *
 * @example
 * // Wrap your app tree:
 * <AuthProvider><App /></AuthProvider>
 *
 * // Consume in any child component:
 * const { user, login, logout } = useAuth();
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api, getToken, setToken, clearToken } from '../api';

/**
 * React Context for authentication state.
 * Defaults to null; always consumed via the `useAuth` hook.
 * @type {React.Context<AuthContextValue|null>}
 */
const AuthContext = createContext(null);

/**
 * @typedef {Object} AuthContextValue
 * @property {Object|null} user - The authenticated user object, or null if logged out.
 * @property {Function} setUser - Directly set the user object (used by other hooks/pages).
 * @property {boolean} loading - True while the initial auth check is in progress.
 * @property {Function} register - Register a new user account.
 * @property {Function} login - Log in an existing user.
 * @property {Function} logout - Log out the current user.
 * @property {Function} refreshUser - Re-fetch the user profile from the server.
 */

/**
 * Authentication context provider component.
 *
 * On mount, checks sessionStorage for a stored JWT. If found, validates it
 * against the server via `api.me()`. If validation fails the token is cleared,
 * effectively logging the user out. While this check is pending, `loading`
 * is true so downstream components can show a loading state.
 *
 * @component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components that will have access to auth context.
 * @returns {React.ReactElement}
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: validate stored token on initial mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      api.me()
        .then(data => setUser(data.user))
        .catch(() => clearToken()) // Token is invalid or expired; discard it
        .finally(() => setLoading(false));
    } else {
      // No stored token -- immediately mark loading as complete
      setLoading(false);
    }
  }, []);

  /**
   * Creates a new user account, stores the returned JWT, and sets the user.
   *
   * @param {string} username - Unique username.
   * @param {string} password - User's password.
   * @param {string} display_name - Display name shown to other users.
   * @returns {Promise<Object>} The newly created user object.
   */
  const register = useCallback(async (username, password, display_name) => {
    const data = await api.register({ username, password, display_name });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Authenticates an existing user, stores the returned JWT, and sets the user.
   *
   * @param {string} username - The user's username.
   * @param {string} password - The user's password.
   * @returns {Promise<Object>} The authenticated user object.
   */
  const login = useCallback(async (username, password) => {
    const data = await api.login({ username, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Logs out the current user by calling the server logout endpoint, clearing
   * the stored token, and resetting the user to null.
   *
   * The server call is wrapped in a try/catch so that token cleanup always
   * happens even if the network request fails.
   *
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    clearToken();
    setUser(null);
  }, []);

  /**
   * Re-fetches the current user's profile from the server. Useful after
   * profile updates, onboarding completion, or point changes to keep the
   * client-side user object in sync.
   *
   * @returns {Promise<Object>} The refreshed user object.
   */
  const refreshUser = useCallback(async () => {
    const data = await api.me();
    setUser(data.user);
    return data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, register, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to consume the authentication context.
 *
 * Must be called from within an `<AuthProvider>`. Throws an error if used
 * outside the provider tree so misuse is caught immediately during development.
 *
 * @returns {AuthContextValue} The authentication context value.
 * @throws {Error} If called outside of an AuthProvider.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
