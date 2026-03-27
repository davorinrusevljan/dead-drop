'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
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

  useEffect(() => {
    if (user) {
      fetch(`${API_BASE_URL}/api/stats/activity?period=${selectedPeriod}`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data: unknown) => setActivity(data as ActivityData))
        .catch(() => {});
    }
  }, [selectedPeriod, user]);

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

  const tierData = distribution
    ? [
        { name: 'Free', value: distribution.byTier.free },
        { name: 'Deep', value: distribution.byTier.deep },
      ]
    : [];

  const visibilityData = distribution
    ? [
        { name: 'Public', value: distribution.byVisibility.public },
        { name: 'Private', value: distribution.byVisibility.private },
      ]
    : [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (selectedPeriod === 'hour') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    if (selectedPeriod === 'day' || selectedPeriod === 'threeDays') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Activity Timeline */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
            <h2 className="text-lg font-medium text-zinc-200 mb-4">Activity Timeline</h2>
            <div className="h-64">
              {activity && activity.buckets.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activity.buckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      stroke="#71717a"
                      fontSize={12}
                    />
                    <YAxis stroke="#71717a" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '4px',
                      }}
                      labelFormatter={formatDate}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="created"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="edited"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="deleted"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  No activity data
                </div>
              )}
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
            <h2 className="text-lg font-medium text-zinc-200 mb-4">Distribution</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm text-zinc-400 mb-2">By Tier</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tierData}>
                      <Bar dataKey="value" fill="#22c55e" />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                      <YAxis stroke="#71717a" fontSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="text-sm text-zinc-400 mb-2">By Visibility</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visibilityData}>
                      <Bar dataKey="value" fill="#3b82f6" />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                      <YAxis stroke="#71717a" fontSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                {activity?.recent?.map((item, i) => (
                  <tr key={i} className="border-b border-[#27272a]/50">
                    <td className="py-2">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
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
                    <td className="py-2 text-sm text-zinc-500">
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
