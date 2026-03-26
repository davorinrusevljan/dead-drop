'use client';

import { useState } from 'react';

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
      const response = await fetch('/api/auth/login', {
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

      // Redirect to dashboard on success
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#22c55e] mb-2">dead-drop</h1>
            <p className="text-zinc-400 text-sm">Admin Panel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#27272a] rounded-md text-zinc-200 focus:outline-none focus:border-[#22c55e] transition-colors"
                placeholder="Enter username"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#27272a] rounded-md text-zinc-200 focus:outline-none focus:border-[#22c55e] transition-colors"
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-md px-4 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-[#22c55e]/50 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:ring-offset-2 focus:ring-offset-[#18181b]"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-zinc-500 text-xs mt-6">dead-drop.xyz Admin Panel</p>
      </div>
    </div>
  );
}
