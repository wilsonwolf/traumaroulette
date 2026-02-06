const API_BASE = '/api';

function getToken() {
  return sessionStorage.getItem('token');
}

function setToken(token) {
  sessionStorage.setItem('token', token);
}

function clearToken() {
  sessionStorage.removeItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Users
  updateProfile: (body) => request('/users/profile', { method: 'PUT', body }),
  submitTrauma: (body) => request('/users/trauma', { method: 'POST', body }),
  completeOnboarding: () => request('/users/complete-onboarding', { method: 'POST' }),
  leaderboard: () => request('/users/leaderboard'),
  getUser: (id) => request(`/users/${id}`),

  // Upload
  uploadProfilePhoto: (formData) => request('/upload/profile-photo', { method: 'POST', body: formData }),
  uploadPhoto: (formData) => request('/upload/photo', { method: 'POST', body: formData }),
  uploadVoice: (formData) => request('/upload/voice', { method: 'POST', body: formData }),

  // Conversations
  getConversations: () => request('/conversations'),
  getConversation: (id) => request(`/conversations/${id}`),

  // Points
  getPoints: () => request('/points'),
};

export { getToken, setToken, clearToken };
