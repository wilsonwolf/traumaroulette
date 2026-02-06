/**
 * @file App.jsx
 * @description Root application component for TraumaChat.
 *
 * Sets up the React Router, wraps the app in the AuthProvider context, and
 * defines all client-side routes. Includes a `ProtectedRoute` wrapper that
 * enforces authentication and onboarding completion before granting access
 * to inner pages.
 *
 * Route structure:
 *   /                       -> Landing (login/register) or redirect to /lobby
 *   /onboarding             -> Onboarding wizard (does not require completed onboarding)
 *   /lobby                  -> Main lobby
 *   /matching               -> Queue / searching screen
 *   /chat/:conversationId   -> Live chat page
 *   /postchat/:conversationId -> Post-conversation summary
 *   /profile                -> User profile, points, leaderboard
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Lobby from './pages/Lobby';
import Matching from './pages/Matching';
import Chat from './pages/Chat';
import PostChat from './pages/PostChat';
import Profile from './pages/Profile';
import './App.css';

/**
 * Route guard component that restricts access to authenticated users.
 *
 * If the user is not logged in they are redirected to the landing page.
 * When `requireOnboarding` is true (the default), users who have not
 * completed onboarding are redirected to /onboarding instead.
 *
 * @component
 * @param {Object} props
 * @param {React.ReactNode} props.children - The child route element to render when access is granted.
 * @param {boolean} [props.requireOnboarding=true] - Whether onboarding completion is required.
 * @returns {React.ReactElement} The children or a redirect.
 */
function ProtectedRoute({ children, requireOnboarding = true }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/" />;
  if (requireOnboarding && !user.onboarding_complete) return <Navigate to="/onboarding" />;
  return children;
}

/**
 * Defines the full set of application routes.
 *
 * The root path `/` performs a smart redirect: authenticated users go to
 * /lobby (or /onboarding if incomplete), while unauthenticated users see
 * the Landing page.
 *
 * @component
 * @returns {React.ReactElement} The rendered route tree.
 */
function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Routes>
      {/* Root: redirect authenticated users, show Landing for guests */}
      <Route path="/" element={user ? <Navigate to={user.onboarding_complete ? "/lobby" : "/onboarding"} /> : <Landing />} />
      {/* Onboarding does not require onboarding_complete (circular dependency) */}
      <Route path="/onboarding" element={
        <ProtectedRoute requireOnboarding={false}>
          <Onboarding />
        </ProtectedRoute>
      } />
      <Route path="/lobby" element={
        <ProtectedRoute><Lobby /></ProtectedRoute>
      } />
      <Route path="/matching" element={
        <ProtectedRoute><Matching /></ProtectedRoute>
      } />
      <Route path="/chat/:conversationId" element={
        <ProtectedRoute><Chat /></ProtectedRoute>
      } />
      <Route path="/postchat/:conversationId" element={
        <ProtectedRoute><PostChat /></ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute><Profile /></ProtectedRoute>
      } />
    </Routes>
  );
}

/**
 * Top-level App component.
 *
 * Wraps the entire application in `AuthProvider` (for authentication context)
 * and `BrowserRouter` (for client-side routing).
 *
 * @component
 * @returns {React.ReactElement} The fully-wrapped application.
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
