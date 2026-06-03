import { useState, useEffect, useCallback, Fragment } from 'react';
import { getSMSLogs } from '../api.js';

const STATUS_BADGE = {
  success: 'badge-success',
  partial: 'badge-warning',
  failed: 'badge-danger',
};

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function SMSHistory() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSMSLogs({ page, limit: LIMIT });
      setLogs(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">SMS History</h1>
          <p className="page-subtitle">{total} total message batch{total !== 1 ? 'es' : ''} sent.</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : '↺ Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading history…</span></div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No messages sent yet</div>
            <div className="empty-state-text">Go to "Send SMS" to send your first bulk message.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Message</th>
                  <th>Categories</th>
                  <th>Recipients</th>
                  <th>Delivered</th>
                  <th>Failed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const catIds = Array.isArray(log.category_ids) ? log.category_ids : [];
                  const catLabel = catIds.length === 0
                    ? <span className="tag">All contacts</span>
                    : <span className="tag">{catIds.length} categor{catIds.length === 1 ? 'y' : 'ies'}</span>;

                  const isExpanded = expanded === log.id;
                  const preview = log.message?.length > 80
                    ? log.message.slice(0, 80) + '…'
                    : log.message;

                  return (
                    <Fragment key={log.id}>
                      <tr
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                      >
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--gray-500)', fontSize: 13 }}>
                          {formatDate(log.sent_at)}
                        </td>
                        <td style={{ maxWidth: 280 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {preview || '—'}
                          </span>
                        </td>
                        <td>{catLabel}</td>
                        <td style={{ fontWeight: 600 }}>{log.recipient_count}</td>
                        <td><span className="badge badge-success">{log.successful}</span></td>
                        <td>
                          {log.failed > 0
                            ? <span className="badge badge-danger">{log.failed}</span>
                            : <span className="badge badge-gray">{log.failed}</span>}
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[log.status] || 'badge-gray'}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: 'var(--gray-50)' }}>
                          <td colSpan={7} style={{ padding: '12px 20px' }}>
                            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13, color: 'var(--gray-500)' }}>
                              Full message:
                            </div>
                            <div style={{
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              lineHeight: 1.6, fontSize: 14, color: 'var(--gray-700)',
                              background: 'white', padding: '10px 12px',
                              borderRadius: 8, border: '1px solid var(--gray-100)',
                            }}>
                              {log.message}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}>
                ← Prev
              </button>
              <span style={{ color: 'var(--gray-500)', fontSize: 14 }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
