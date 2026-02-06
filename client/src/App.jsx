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

function ProtectedRoute({ children, requireOnboarding = true }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/" />;
  if (requireOnboarding && !user.onboarding_complete) return <Navigate to="/onboarding" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={user.onboarding_complete ? "/lobby" : "/onboarding"} /> : <Landing />} />
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
