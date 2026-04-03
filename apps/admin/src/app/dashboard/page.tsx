'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api-config';

interface OverviewStats {
  totalDrops: number;
  activeDrops: number;
}

interface PeriodCounts {
  created: number;
  edited: number;
  deleted: number;
}

interface DistributionStats {
  byTier: { free: number; deep: number };
  byVisibility: { public: number; private: number };
}

interface ActivityData {
  buckets: Array<{
    date: string;
    created: number;
    edited: number;
    deleted: number;
  }>;
  recent: Array<{
    action: string;
    dropId: string;
    createdAt: string;
  }>;
}

interface User {
  id: number;
  username: string;
  role: string;
}

interface MeResponse {
  authenticated: boolean;
  user?: User;
}

type TimePeriod = 'hour' | 'day' | 'threeDays' | 'week' | 'month' | 'year';

const PERIOD_LABELS: Record<TimePeriod, string> = {
  hour: 'Last Hour',
  day: 'Last 24 Hours',
  threeDays: 'Last 3 Days',
  week: 'Last Week',
  month: 'Last Month',
  year: 'Last Year',
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [periodCounts, setPeriodCounts] = useState<Record<TimePeriod, PeriodCounts> | null>(null);
  const [distribution, setDistribution] = useState<DistributionStats | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, periodRes, distRes, activityRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/stats/overview`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/stats/by-period`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/stats/distribution`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/stats/activity?period=${selectedPeriod}`, {
          credentials: 'include',
        }),
      ]);

      if (overviewRes.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (periodRes.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (distRes.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (activityRes.status === 401) {
        window.location.href = '/login';
        return;
      }

      const overviewData: OverviewStats = await overviewRes.json();
      const periodData: Record<TimePeriod, PeriodCounts> = await periodRes.json();
      const distData: DistributionStats = await distRes.json();
      const activityData: ActivityData = await activityRes.json();

      setOverview(overviewData);
      setPeriodCounts(periodData);
      setDistribution(distData);
      setActivity(activityData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: unknown) => {
        const meData = data as MeResponse;
        if (!meData.authenticated || !meData.user) {
          window.location.href = '/login';
          return;
        }
        setUser(meData.user);
        fetchData();
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }, [fetchData]);

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
          <a href="/dashboard" className="admin-header-link active">
            Dashboard
          </a>
          {user?.role === 'superadmin' && (
            <a href="/users" className="admin-header-link">
              Users
            </a>
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

        {/* Overview Stats */}
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-label">Total Drops</div>
            <div className="admin-stat-value accent">{overview?.totalDrops ?? 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Active Drops</div>
            <div className="admin-stat-value success">{overview?.activeDrops ?? 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Created Today</div>
            <div className="admin-stat-value">{periodCounts?.day?.created ?? 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Created This Week</div>
            <div className="admin-stat-value">{periodCounts?.week?.created ?? 0}</div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="admin-period-selector">
          {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`admin-period-btn ${selectedPeriod === period ? 'active' : ''}`}
            >
              {PERIOD_LABELS[period]}
            </button>
          ))}
        </div>

        {/* Period Events */}
        {periodCounts && (
          <div className="admin-stats-grid" style={{ marginBottom: '2rem' }}>
            <div className="admin-stat-card">
              <div className="admin-stat-label">Created</div>
              <div className="admin-stat-value success">
                {periodCounts[selectedPeriod]?.created ?? 0}
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-label">Edited</div>
              <div className="admin-stat-value warning">
                {periodCounts[selectedPeriod]?.edited ?? 0}
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-label">Deleted</div>
              <div className="admin-stat-value danger">
                {periodCounts[selectedPeriod]?.deleted ?? 0}
              </div>
            </div>
          </div>
        )}

        {/* Distribution Stats */}
        {distribution && (
          <div className="admin-distribution-grid">
            <div className="admin-distribution-item">
              <div className="admin-distribution-label">Free Drops</div>
              <div className="admin-distribution-value">{distribution.byTier.free}</div>
            </div>
            <div className="admin-distribution-item">
              <div className="admin-distribution-label">Deep Drops</div>
              <div className="admin-distribution-value">{distribution.byTier.deep}</div>
            </div>
            <div className="admin-distribution-item">
              <div className="admin-distribution-label">Public</div>
              <div className="admin-distribution-value">{distribution.byVisibility.public}</div>
            </div>
            <div className="admin-distribution-item">
              <div className="admin-distribution-label">Private</div>
              <div className="admin-distribution-value">{distribution.byVisibility.private}</div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="admin-card">
          <h2 className="admin-card-title">Recent Activity</h2>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Drop ID</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {activity?.recent?.slice(0, 20).map((item, i) => (
                  <tr key={i}>
                    <td>
                      {item.action === 'created' && (
                        <span className="admin-badge admin-badge-success">Created</span>
                      )}
                      {item.action === 'edited' && (
                        <span className="admin-badge admin-badge-warning">Edited</span>
                      )}
                      {item.action === 'deleted' && (
                        <span className="admin-badge admin-badge-danger">Deleted</span>
                      )}
                    </td>
                    <td>
                      <code style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8125rem' }}>
                        {item.dropId.slice(0, 16)}...
                      </code>
                    </td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {(!activity?.recent || activity.recent.length === 0) && (
                  <tr>
                    <td colSpan={3}>
                      <div className="admin-empty">
                        <div className="admin-empty-icon">📭</div>
                        No recent activity
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
