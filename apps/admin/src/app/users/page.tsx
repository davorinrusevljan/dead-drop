'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api-config';

interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface CurrentUser {
  id: number;
  username: string;
  role: string;
}

interface MeResponse {
  authenticated: boolean;
  user?: CurrentUser;
}

interface UsersResponse {
  users: User[];
}

interface ApiResponse {
  success?: boolean;
  user?: User;
  error?: { code: string; message: string };
}

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'superadmin'>('admin');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Edit password form
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editPassword, setEditPassword] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 403) {
        window.location.href = '/dashboard';
        return;
      }
      const data: UsersResponse = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: unknown) => {
        const meData = data as MeResponse;
        if (!meData.authenticated || !meData.user) {
          window.location.href = '/login';
          return;
        }
        if (meData.user.role !== 'superadmin') {
          window.location.href = '/dashboard';
          return;
        }
        setCurrentUser(meData.user);
        fetchUsers();
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        setError(data.error?.message || 'Failed to create user');
        return;
      }

      setSuccess('User created successfully');
      setNewUsername('');
      setNewPassword('');
      setNewRole('admin');
      setShowCreateForm(false);
      fetchUsers();
    } catch (err) {
      setError('Network error');
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    clearMessages();

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        setError(data.error?.message || 'Failed to delete user');
        return;
      }

      setSuccess('User deleted successfully');
      fetchUsers();
    } catch (err) {
      setError('Network error');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (editPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${editingUserId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: editPassword }),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        setError(data.error?.message || 'Failed to update password');
        return;
      }

      setSuccess('Password updated successfully');
      setEditingUserId(null);
      setEditPassword('');
    } catch (err) {
      setError('Network error');
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="bg-[#18181b] border-b border-[#27272a] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-[#22c55e]">dead-drop</h1>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-400">User Management</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">
              {currentUser?.username} <span className="text-zinc-500">({currentUser?.role})</span>
            </span>
            <a
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Dashboard
            </a>
            <button
              onClick={handleLogout}
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-md px-4 py-2 text-sm text-red-400 mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/50 rounded-md px-4 py-2 text-sm text-green-400 mb-6">
            {success}
          </div>
        )}

        {/* Create User Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white font-medium rounded-md transition-colors"
          >
            {showCreateForm ? 'Cancel' : 'Create New User'}
          </button>
        </div>

        {/* Create User Form */}
        {showCreateForm && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-zinc-200 mb-4">Create New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#27272a] rounded-md text-zinc-200 focus:outline-none focus:border-[#22c55e]"
                    placeholder="username"
                    required
                    minLength={3}
                    pattern="[a-zA-Z0-9_-]+"
                    title="Alphanumeric, underscore, or hyphen only"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#27272a] rounded-md text-zinc-200 focus:outline-none focus:border-[#22c55e]"
                    placeholder="min 8 chars"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'superadmin')}
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#27272a] rounded-md text-zinc-200 focus:outline-none focus:border-[#22c55e]"
                  >
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white font-medium rounded-md transition-colors"
              >
                Create User
              </button>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
          <h2 className="text-lg font-medium text-zinc-200 mb-4">Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272a]">
                  <th className="text-left text-sm text-zinc-400 pb-3">Username</th>
                  <th className="text-left text-sm text-zinc-400 pb-3">Role</th>
                  <th className="text-left text-sm text-zinc-400 pb-3">Created</th>
                  <th className="text-left text-sm text-zinc-400 pb-3">Last Login</th>
                  <th className="text-left text-sm text-zinc-400 pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[#27272a]/50">
                    <td className="py-3 text-zinc-200">
                      {user.username}
                      {currentUser?.id === user.id && (
                        <span className="ml-2 text-xs text-zinc-500">(you)</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          user.role === 'superadmin'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-zinc-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-sm text-zinc-400">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3">
                      {editingUserId === user.id ? (
                        <form onSubmit={handleUpdatePassword} className="flex gap-2">
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="px-2 py-1 text-sm bg-[#0a0a0f] border border-[#27272a] rounded text-zinc-200 focus:outline-none focus:border-[#22c55e]"
                            placeholder="New password"
                            minLength={8}
                            required
                          />
                          <button
                            type="submit"
                            className="px-2 py-1 text-sm bg-[#22c55e] hover:bg-[#16a34a] text-white rounded"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(null);
                              setEditPassword('');
                            }}
                            className="px-2 py-1 text-sm bg-zinc-600 hover:bg-zinc-500 text-white rounded"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingUserId(user.id)}
                            className="px-2 py-1 text-sm bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded"
                          >
                            Change Password
                          </button>
                          {currentUser?.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              className="px-2 py-1 text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-zinc-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
