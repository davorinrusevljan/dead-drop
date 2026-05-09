'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api-config';

interface User {
  id: number;
  username: string;
  role: string;
}

interface MeResponse {
  authenticated: boolean;
  user?: User;
}

type BackupStatus = 'pending' | 'running' | 'complete' | 'failed';

interface BackupRecord {
  id: number;
  status: BackupStatus;
  r2Key: string | null;
  sizeBytes: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface BackupListResponse {
  backups: BackupRecord[];
}

interface BackupStartResponse {
  id: number;
  status: BackupStatus;
  r2Key?: string;
  sizeBytes?: number;
  error?: { code: string; message: string };
}

interface BackupStatusResponse {
  id: number;
  status: BackupStatus;
  r2Key?: string | null;
  sizeBytes?: number | null;
  errorMessage?: string | null;
  error?: { code: string; message: string };
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: BackupStatus) {
  const styles: Record<BackupStatus, React.CSSProperties> = {
    pending: { background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640' },
    running: { background: '#f59e0b20', color: '#fbbf24', border: '1px solid #f59e0b40' },
    complete: { background: '#22c55e20', color: '#4ade80', border: '1px solid #22c55e40' },
    failed: { background: '#ef444420', color: '#f87171', border: '1px solid #ef444440' },
  };
  return (
    <span
      style={{
        ...styles[status],
        padding: '0.125rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {status}
    </span>
  );
}

const POLL_INTERVAL = 3000;

export default function MaintenancePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [starting, setStarting] = useState(false);
  const [activeBackupId, setActiveBackupId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/maintenance/backup`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data: BackupListResponse = await res.json();
      setBackups(data.backups || []);
    } catch {
      setError('Failed to load backups');
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollBackupStatus = useCallback(
    (backupId: number) => {
      stopPolling();
      setActiveBackupId(backupId);

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/maintenance/backup/${backupId}`, {
            credentials: 'include',
          });

          if (!res.ok) {
            // Don't stop polling on transient errors
            return;
          }

          const data: BackupStatusResponse = await res.json();

          if (data.status === 'complete') {
            stopPolling();
            setActiveBackupId(null);
            setSuccess(`Backup complete — ${formatBytes(data.sizeBytes ?? null)}`);
            fetchBackups();
          } else if (data.status === 'failed') {
            stopPolling();
            setActiveBackupId(null);
            setError(`Backup failed: ${data.errorMessage ?? 'Unknown error'}`);
            fetchBackups();
          }
          // Still running — continue polling
        } catch {
          // Transient network error — continue polling
        }
      }, POLL_INTERVAL);
    },
    [stopPolling, fetchBackups]
  );

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
        setUser(meData.user);
        fetchBackups();
      })
      .catch(() => {
        window.location.href = '/login';
      })
      .finally(() => setLoading(false));
  }, [fetchBackups]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleStartBackup = async () => {
    setError('');
    setSuccess('');
    setStarting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/maintenance/backup/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      const data: BackupStartResponse = await res.json();

      if (!res.ok) {
        setError(data.error?.message || 'Failed to start backup');
        return;
      }

      if (data.status === 'complete') {
        // Completed immediately
        setSuccess(`Backup complete — ${formatBytes(data.sizeBytes ?? null)}`);
        fetchBackups();
      } else {
        // Running — start polling
        pollBackupStatus(data.id);
      }
    } catch {
      setError('Network error');
    } finally {
      setStarting(false);
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

  const isRunning = activeBackupId !== null || starting;

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
          {user?.role === 'superadmin' && (
            <>
              <a href="/users" className="admin-header-link">
                Users
              </a>
              <a href="/maintenance" className="admin-header-link active">
                Maintenance
              </a>
            </>
          )}
        </nav>
        <div className="admin-header-user">
          <div className="admin-header-user-info">
            {user?.username} <span>({user?.role})</span>
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

        {/* Database Backup Section */}
        <div className="admin-card" style={{ marginBottom: '2rem' }}>
          <h2 className="admin-card-title">Database Backup</h2>
          <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Create a full SQL export of the core database. Backups are stored in Cloudflare R2 and
            can be used to restore data.
          </p>

          <button
            onClick={handleStartBackup}
            disabled={isRunning}
            className="admin-btn admin-btn-primary"
            style={{
              opacity: isRunning ? 0.6 : 1,
              cursor: isRunning ? 'not-allowed' : 'pointer',
            }}
          >
            {starting ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid transparent',
                    borderTop: '2px solid currentColor',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                    marginRight: '0.5rem',
                    verticalAlign: 'middle',
                  }}
                />
                Starting...
              </>
            ) : activeBackupId ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid transparent',
                    borderTop: '2px solid currentColor',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                    marginRight: '0.5rem',
                    verticalAlign: 'middle',
                  }}
                />
                Backup in progress...
              </>
            ) : (
              'Create Backup'
            )}
          </button>
        </div>

        {/* Backup History */}
        <div className="admin-card">
          <h2 className="admin-card-title">Backup History</h2>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Size</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <code style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8125rem' }}>
                        #{backup.id}
                      </code>
                    </td>
                    <td>{statusBadge(backup.status)}</td>
                    <td>{formatBytes(backup.sizeBytes)}</td>
                    <td>{new Date(backup.startedAt).toLocaleString()}</td>
                    <td>
                      {backup.completedAt ? new Date(backup.completedAt).toLocaleString() : '—'}
                    </td>
                    <td>
                      {backup.errorMessage && (
                        <span style={{ color: '#f87171', fontSize: '0.8125rem' }}>
                          {backup.errorMessage}
                        </span>
                      )}
                      {backup.r2Key && (
                        <code
                          style={{
                            fontFamily: 'JetBrains Mono',
                            fontSize: '0.75rem',
                            color: '#71717a',
                          }}
                        >
                          {backup.r2Key}
                        </code>
                      )}
                    </td>
                  </tr>
                ))}
                {backups.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="admin-empty">
                        <div className="admin-empty-icon">💾</div>
                        No backups yet
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
