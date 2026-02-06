/**
 * @file Landing.jsx
 * @description Login and registration page -- the entry point for unauthenticated users.
 *
 * Displays a toggle-able form that supports both login (existing users) and
 * registration (new users). On successful authentication the AuthProvider
 * updates the user context, which triggers App.jsx to redirect to /lobby or
 * /onboarding.
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Landing page component with login/register form.
 *
 * Manages a single form that switches between login and registration mode.
 * The `isLogin` flag controls which fields are shown and which auth action
 * is called on submit. Error messages from the server are displayed inline.
 *
 * @component
 * @returns {React.ReactElement} The landing page UI.
 */
export default function Landing() {
  const { login, register } = useAuth();
  /** @type {[boolean, Function]} Toggle between login (true) and register (false) modes */
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  /** @type {[string, Function]} Only used in registration mode */
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handles form submission for both login and registration.
   * Calls the appropriate auth method from the context and surfaces any
   * server errors in the inline error display.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - The form submit event.
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, displayName);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing">
      <h1>TraumaChat</h1>
      <p className="subtitle">
        Talk to strangers. Reveal your trauma. Make questionable connections. 3 minutes at a time.
      </p>

      <div className="auth-box">
        <h2>{isLogin ? 'Welcome Back' : 'Join the Chaos'}</h2>
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
            />
          )}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p className="error" style={{color:'#ff6b6b',marginBottom:8}}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Loading...' : isLogin ? 'Log In' : 'Create Account'}
          </button>
        </form>
        <p className="auth-toggle">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Sign Up' : 'Log In'}
          </span>
        </p>
      </div>
    </div>
  );
}
