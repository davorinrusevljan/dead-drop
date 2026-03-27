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
  day: 'Last 24 hours',
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
    // Check auth
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
            <span className="text-zinc-400">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">
              {user?.username} <span className="text-zinc-500">({user?.role})</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Sign Out
            </button>
            {user?.role === 'superadmin' && (
              <a
                href="/users"
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Users
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-md px-4 py-2 text-sm text-red-400 mb-6">
            {error}
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Drops" value={overview?.totalDrops ?? 0} />
          <StatCard title="Active Drops" value={overview?.activeDrops ?? 0} />
          <StatCard title="Created Today" value={periodCounts?.day?.created ?? 0} />
          <StatCard title="Created This Week" value={periodCounts?.week?.created ?? 0} />
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                selectedPeriod === period
                  ? 'bg-[#22c55e] text-white'
                  : 'bg-[#18181b] text-zinc-400 hover:text-zinc-200 border border-[#27272a]'
              }`}
            >
              {PERIOD_LABELS[period]}
            </button>
          ))}
        </div>

        {/* Events for Selected Period */}
        {periodCounts && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              title="Created"
              value={periodCounts[selectedPeriod]?.created ?? 0}
              color="text-green-400"
            />
            <StatCard
              title="Edited"
              value={periodCounts[selectedPeriod]?.edited ?? 0}
              color="text-yellow-400"
            />
            <StatCard
              title="Deleted"
              value={periodCounts[selectedPeriod]?.deleted ?? 0}
              color="text-red-400"
            />
          </div>
        )}

        {/* Distribution Stats (Text-based) */}
        {distribution && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
              <h2 className="text-lg font-medium text-zinc-200 mb-4">By Tier</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#22c55e]">
                    {distribution.byTier.free}
                  </div>
                  <div className="text-sm text-zinc-400">Free</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#3b82f6]">
                    {distribution.byTier.deep}
                  </div>
                  <div className="text-sm text-zinc-400">Deep</div>
                </div>
              </div>
            </div>
            <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
              <h2 className="text-lg font-medium text-zinc-200 mb-4">By Visibility</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-zinc-200">
                    {distribution.byVisibility.public}
                  </div>
                  <div className="text-sm text-zinc-400">Public</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-zinc-200">
                    {distribution.byVisibility.private}
                  </div>
                  <div className="text-sm text-zinc-400">Private</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
          <h2 className="text-lg font-medium text-zinc-200 mb-4">Recent Activity</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272a]">
                  <th className="text-left text-sm text-zinc-400 pb-3">Action</th>
                  <th className="text-left text-sm text-zinc-400 pb-3">Drop ID</th>
                  <th className="text-left text-sm text-zinc-400 pb-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {activity?.recent?.slice(0, 20).map((item, i) => (
                  <tr key={i} className="border-b border-[#27272a]/50">
                    <td className="py-2 text-sm">
                      <span
                        className={`px-2 py-1 rounded ${
                          item.action === 'created'
                            ? 'bg-green-500/10 text-green-400'
                            : item.action === 'edited'
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="py-2 text-sm text-zinc-400 font-mono">
                      {item.dropId.slice(0, 16)}...
                    </td>
                    <td className="py-2 text-sm text-zinc-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {(!activity?.recent || activity.recent.length === 0) && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-zinc-500">
                      No recent activity
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

function StatCard({
  title,
  value,
  color = 'text-zinc-200',
}: {
  title: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
      <div className="text-sm text-zinc-400 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}
