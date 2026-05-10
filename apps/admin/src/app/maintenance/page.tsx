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
type PruneStatus = 'pending' | 'running' | 'complete' | 'failed';

interface BackupRecord {
  id: number;
  status: BackupStatus;
  r2Key: string | null;
  sizeBytes: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface PruneRecord {
  id: number;
  toleranceDays: number;
  prunedCount: number;
  backupId: number | null;
  status: PruneStatus;
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

interface PrunePreviewResponse {
  eligibleCount: number;
  toleranceDays: number;
  cutoff: string;
  backupWarning: string | null;
}

interface PruneResponse {
  id: number;
  status: PruneStatus;
  prunedCount: number;
  toleranceDays: number;
  error?: { code: string; message: string };
}

interface PruneHistoryResponse {
  prunes: PruneRecord[];
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: BackupStatus | PruneStatus) {
  const styles: Record<string, React.CSSProperties> = {
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Backup state
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [starting, setStarting] = useState(false);
  const [activeBackupId, setActiveBackupId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prune state
  const [prunes, setPrunes] = useState<PruneRecord[]>([]);
  const [prunePreview, setPrunePreview] = useState<PrunePreviewResponse | null>(null);
  const [toleranceDays, setToleranceDays] = useState(0);
  const [pruning, setPruning] = useState(false);
  const [showPruneConfirm, setShowPruneConfirm] = useState(false);

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

  const fetchPrunes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/maintenance/prune/history`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data: PruneHistoryResponse = await res.json();
      setPrunes(data.prunes || []);
    } catch {
      /* ignore */
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
          if (!res.ok) return;
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
        } catch {
          /* transient */
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
        fetchPrunes();
      })
      .catch(() => {
        window.location.href = '/login';
      })
      .finally(() => setLoading(false));
  }, [fetchBackups, fetchPrunes]);

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
        setSuccess(`Backup complete — ${formatBytes(data.sizeBytes ?? null)}`);
        fetchBackups();
      } else {
        pollBackupStatus(data.id);
      }
    } catch {
      setError('Network error');
    } finally {
      setStarting(false);
    }
  };

  const handlePreviewPrune = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/maintenance/prune/preview?toleranceDays=${toleranceDays}`,
        { credentials: 'include' }
      );
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data: PrunePreviewResponse = await res.json();
      if (!res.ok) {
        setError((data as unknown as { error: { message: string } }).error?.message);
        return;
      }
      setPrunePreview(data);
      setShowPruneConfirm(true);
    } catch {
      setError('Network error');
    }
  };

  const handleExecutePrune = async () => {
    setShowPruneConfirm(false);
    setPruning(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/maintenance/prune`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toleranceDays }),
      });
      const data: PruneResponse = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Prune failed');
        return;
      }
      setSuccess(`Pruned ${data.prunedCount} expired drop${data.prunedCount !== 1 ? 's' : ''}`);
      fetchPrunes();
      setPrunePreview(null);
    } catch {
      setError('Network error');
    } finally {
      setPruning(false);
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

  const spinner = (
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
  );

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

        {/* Database Backup */}
        <div className="admin-card" style={{ marginBottom: '2rem' }}>
          <h2 className="admin-card-title">Database Backup</h2>
          <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Create a full SQL export of the core database. Backups are stored in Cloudflare R2.
          </p>
          <button
            onClick={handleStartBackup}
            disabled={isRunning}
            className="admin-btn admin-btn-primary"
            style={{ opacity: isRunning ? 0.6 : 1, cursor: isRunning ? 'not-allowed' : 'pointer' }}
          >
            {starting ? (
              <span>{spinner}Starting...</span>
            ) : activeBackupId ? (
              <span>{spinner}Backup in progress...</span>
            ) : (
              'Create Backup'
            )}
          </button>
        </div>

        {/* Prune Expired Drops */}
        <div className="admin-card" style={{ marginBottom: '2rem' }}>
          <h2 className="admin-card-title">Prune Expired Drops</h2>
          <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Remove expired free-tier drops (7+ days old) from the database. Deep-tier drops are
            never pruned.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Tolerance (extra days)</label>
              <select
                value={toleranceDays}
                onChange={(e) => {
                  setToleranceDays(Number(e.target.value));
                  setPrunePreview(null);
                  setShowPruneConfirm(false);
                }}
                className="admin-form-select"
                style={{ width: 'auto' }}
              >
                <option value={0}>0 days (strict)</option>
                <option value={1}>+1 day</option>
                <option value={2}>+2 days</option>
              </select>
            </div>
            <div style={{ paddingTop: '1.5rem' }}>
              <button
                onClick={handlePreviewPrune}
                disabled={pruning}
                className="admin-btn admin-btn-secondary"
              >
                Preview
              </button>
            </div>
          </div>

          {prunePreview && !showPruneConfirm && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: '#18181b',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
              }}
            >
              <strong>{prunePreview.eligibleCount}</strong> drops eligible for pruning (expired
              before {new Date(prunePreview.cutoff).toLocaleString()})
              {prunePreview.backupWarning && (
                <div style={{ color: '#fbbf24', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                  ⚠ {prunePreview.backupWarning}
                </div>
              )}
            </div>
          )}

          {showPruneConfirm && prunePreview && (
            <div
              style={{
                padding: '1rem',
                background: '#ef444410',
                border: '1px solid #ef444430',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: '#f87171' }}>
                  Confirm: Delete {prunePreview.eligibleCount} expired drops?
                </strong>
                {prunePreview.backupWarning && (
                  <div style={{ color: '#fbbf24', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    ⚠ {prunePreview.backupWarning}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleExecutePrune}
                  disabled={pruning}
                  className="admin-btn admin-btn-danger"
                >
                  {pruning ? <span>{spinner}Pruning...</span> : 'Execute Prune'}
                </button>
                <button
                  onClick={() => setShowPruneConfirm(false)}
                  className="admin-btn admin-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Backup History */}
        <div className="admin-card" style={{ marginBottom: '2rem' }}>
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
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <code style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8125rem' }}>
                        #{b.id}
                      </code>
                    </td>
                    <td>{statusBadge(b.status)}</td>
                    <td>{formatBytes(b.sizeBytes)}</td>
                    <td>{new Date(b.startedAt).toLocaleString()}</td>
                    <td>{b.completedAt ? new Date(b.completedAt).toLocaleString() : '—'}</td>
                    <td>
                      {b.errorMessage && (
                        <span style={{ color: '#f87171', fontSize: '0.8125rem' }}>
                          {b.errorMessage}
                        </span>
                      )}
                      {b.r2Key && (
                        <code
                          style={{
                            fontFamily: 'JetBrains Mono',
                            fontSize: '0.75rem',
                            color: '#71717a',
                          }}
                        >
                          {b.r2Key}
                        </code>
                      )}
                    </td>
                  </tr>
                ))}
                {backups.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="admin-empty">
                        <div className="admin-empty-icon">💾</div>No backups yet
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Prune History */}
        <div className="admin-card">
          <h2 className="admin-card-title">Prune History</h2>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Pruned</th>
                  <th>Tolerance</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {prunes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8125rem' }}>
                        #{p.id}
                      </code>
                    </td>
                    <td>{statusBadge(p.status)}</td>
                    <td>{p.prunedCount}</td>
                    <td>+{p.toleranceDays}d</td>
                    <td>{new Date(p.startedAt).toLocaleString()}</td>
                    <td>{p.completedAt ? new Date(p.completedAt).toLocaleString() : '—'}</td>
                    <td>
                      {p.errorMessage && (
                        <span style={{ color: '#f87171', fontSize: '0.8125rem' }}>
                          {p.errorMessage}
                        </span>
                      )}
                      {p.backupId && (
                        <span style={{ fontSize: '0.8125rem', color: '#71717a' }}>
                          Backup #{p.backupId}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {prunes.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="admin-empty">
                        <div className="admin-empty-icon">🧹</div>No prune operations yet
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
