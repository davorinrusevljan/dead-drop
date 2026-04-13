'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api-config';
import { PasswordInput } from '@dead-drop/ui';

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
      <div className="admin-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="admin-loader">
          <div className="admin-loader-spinner" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <a href="/dashboard" className="admin-header-logo">
            dead-drop
          </a>
        </div>
        <nav className="admin-header-nav">
          <a href="/dashboard" className="admin-header-link">
            Dashboard
          </a>
          <a href="/users" className="admin-header-link active">
            Users
          </a>
        </nav>
        <div className="admin-header-user">
          <div className="admin-header-user-info">
            {currentUser?.username} <span>({currentUser?.role})</span>
          </div>
          <button onClick={handleLogout} className="admin-header-btn">
            Sign Out
          </button>
        </div>
      </header>

      <main className="admin-main">
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

        {success && (
          <div className="admin-alert admin-alert-success">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Create User Button */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="admin-btn admin-btn-primary"
          >
            {showCreateForm ? 'Cancel' : 'Create New User'}
          </button>
        </div>

        {/* Create User Form */}
        {showCreateForm && (
          <div className="admin-card" style={{ marginBottom: '2rem' }}>
            <h2 className="admin-card-title">Create New User</h2>
            <form onSubmit={handleCreateUser}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div className="admin-form-group">
                  <label className="admin-form-label">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="admin-form-input"
                    placeholder="username"
                    required
                    minLength={3}
                    pattern="[a-zA-Z0-9_-]+"
                    title="Alphanumeric, underscore, or hyphen only"
                  />
                </div>
                <PasswordInput
                  label="Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="admin-form-input"
                  placeholder="min 8 chars"
                  required
                  minLength={8}
                />
                <div className="admin-form-group">
                  <label className="admin-form-label">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'superadmin')}
                    className="admin-form-select"
                  >
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div className="admin-card">
          <h2 className="admin-card-title">Users</h2>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{user.username}</span>
                      {currentUser?.id === user.id && (
                        <span
                          className="admin-badge admin-badge-admin"
                          style={{ marginLeft: '0.5rem' }}
                        >
                          you
                        </span>
                      )}
                    </td>
                    <td>
                      {user.role === 'superadmin' ? (
                        <span className="admin-badge admin-badge-superadmin">Superadmin</span>
                      ) : (
                        <span className="admin-badge admin-badge-admin">Admin</span>
                      )}
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      {editingUserId === user.id ? (
                        <form
                          onSubmit={handleUpdatePassword}
                          style={{ display: 'flex', gap: '0.5rem' }}
                        >
                          <div style={{ position: 'relative' }}>
                            <input
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              className="admin-form-input admin-form-input-sm"
                              placeholder="New password"
                              minLength={8}
                              required
                              style={{
                                padding: '0.5rem 2.75rem 0.5rem 0.75rem',
                                fontSize: '0.8125rem',
                              }}
                              id={`edit-pwd-${user.id}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `edit-pwd-${user.id}`
                                ) as HTMLInputElement;
                                input.type = input.type === 'password' ? 'text' : 'password';
                              }}
                              style={{
                                position: 'absolute',
                                right: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#71717a',
                                padding: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                          </div>
                          <button
                            type="submit"
                            className="admin-btn admin-btn-primary admin-btn-sm"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(null);
                              setEditPassword('');
                            }}
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => setEditingUserId(user.id)}
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                          >
                            Change Password
                          </button>
                          {currentUser?.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              className="admin-btn admin-btn-danger admin-btn-sm"
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
                    <td colSpan={5}>
                      <div className="admin-empty">
                        <div className="admin-empty-icon">👥</div>
                        No users found
                      </div>
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
