import { useState, useEffect } from 'react';
import { getDashboardStats, getSMSLogs } from '../api.js';

function StatCard({ icon, iconColor, label, value, desc }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconColor}`}>{icon}</div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {desc && <div className="stat-desc">{desc}</div>}
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const [statsData, logsData] = await Promise.all([
          getDashboardStats().catch(() => null),
          getSMSLogs({ limit: 10 }).catch(() => []),
        ]);
        setStats(statsData);
        const rawLogs = Array.isArray(logsData)
          ? logsData
          : logsData?.logs || logsData?.data || [];
        setLogs(rawLogs.slice(0, 10));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back — here's your SMS platform overview.</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 24 }}>
          ⚠️ {error}
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          icon="👥"
          iconColor="blue"
          label="Total Contacts"
          value={stats?.totalContacts ?? '—'}
          desc="Across all categories"
        />
        <StatCard
          icon="🏷️"
          iconColor="purple"
          label="Categories"
          value={stats?.totalCategories ?? '—'}
          desc="Contact groups"
        />
        <StatCard
          icon="📝"
          iconColor="orange"
          label="Templates"
          value={stats?.totalTemplates ?? '—'}
          desc="Reusable messages"
        />
        <StatCard
          icon="📤"
          iconColor="green"
          label="SMS Sent Today"
          value={stats?.smsSentToday ?? '—'}
          desc="Messages dispatched"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent SMS Activity</span>
          <a href="/history" style={{ fontSize: 13, color: 'var(--primary)' }}>
            View all →
          </a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No messages sent yet</div>
              <div className="empty-state-text">
                Head to "Send SMS" to send your first bulk message.
              </div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Message Preview</th>
                  <th>Categories</th>
                  <th>Recipients</th>
                  <th>Delivered</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const msg = log.message || '';
                  const preview = msg.length > 60 ? msg.slice(0, 60) + '…' : msg;
                  const recipients = log.recipient_count ?? '—';
                  const success = log.successful ?? '—';
                  const failed = log.failed ?? '—';
                  const catIds = Array.isArray(log.category_ids) ? log.category_ids : [];
                  const catStr = catIds.length === 0 ? 'All contacts' : `${catIds.length} categor${catIds.length === 1 ? 'y' : 'ies'}`;
                  return (
                    <tr key={log.id || i}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--gray-500)', fontSize: 13 }}>
                        {formatDate(log.sent_at)}
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <span style={{ color: 'var(--gray-700)' }}>{preview || '—'}</span>
                      </td>
                      <td>
                        <span className="tag">{catStr}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{recipients}</td>
                      <td>
                        <span className="badge badge-success">{success}</span>
                      </td>
                      <td>
                        {failed !== '—' && Number(failed) > 0 ? (
                          <span className="badge badge-danger">{failed}</span>
                        ) : (
                          <span className="badge badge-gray">{failed}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
