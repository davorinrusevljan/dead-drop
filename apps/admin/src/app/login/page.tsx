'use client';

import { useState } from 'react';
import { API_BASE_URL } from '@/lib/api-config';

interface LoginResponse {
  success?: boolean;
  user?: { id: number; username: string; role: string };
  error?: { code: string; message: string };
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Login failed');
        return;
      }

      window.location.href = '/dashboard';
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h1 className="admin-login-logo">dead-drop</h1>
          <p className="admin-login-subtitle">Admin Panel</p>
        </div>

        {error && (
          <div className="admin-alert admin-alert-error">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="admin-form-group">
            <label htmlFor="username" className="admin-form-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="admin-form-input"
              placeholder="Enter username"
              required
              autoComplete="username"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="password" className="admin-form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-form-input"
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="admin-btn admin-btn-primary"
            style={{ width: '100%' }}
          >
            {loading ? (
              <>
                <div className="admin-loader-spinner" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="admin-login-footer">dead-drop.xyz Admin Panel</div>
      </div>
    </div>
  );
}
