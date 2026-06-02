import { useState, useEffect, useCallback } from 'react';
import Modal from '../components/Modal.jsx';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../api.js';

const PLACEHOLDERS = ['{name}', '{phone}', '{company}', '{email}'];
const emptyForm = { name: '', content: '' };

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTemplates();
      setTemplates(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  function insertPlaceholder(ph) {
    setForm(f => ({ ...f, content: f.content + ph }));
  }

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(t) {
    setEditTarget(t);
    setForm({ name: t.name || '', content: t.content || '' });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Template name is required.'); return; }
    if (!form.content.trim()) { setFormError('Message content is required.'); return; }
    try {
      setSaving(true);
      setFormError('');
      if (editTarget) {
        await updateTemplate(editTarget.id, form);
        setSuccess('Template updated.');
      } else {
        await createTemplate(form);
        setSuccess('Template created.');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteTemplate(deleteTarget.id);
      setSuccess('Template deleted.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError(e.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">Reusable message templates with personalisation placeholders.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Template</button>
      </div>

      {success && <div className="alert alert-success">✓ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading templates…</span></div>
      ) : templates.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">No templates yet</div>
            <div className="empty-state-text">Create a template to quickly reuse common messages.</div>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={openCreate}>
              + New Template
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {templates.map(t => (
            <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>{t.name}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  {t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}
                </span>
              </div>
              <div style={{
                flex: 1, background: 'var(--gray-50)', borderRadius: 8, padding: '10px 12px',
                fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: 60,
              }}>
                {t.content}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>✏️ Edit</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                  onClick={() => setDeleteTarget(t)}>🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Template' : 'New Template'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Template'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="form-group">
            <label>Template Name *</label>
            <input type="text" placeholder="e.g. Monthly Newsletter" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div className="form-group">
            <label>Message Content *</label>
            <div style={{ marginBottom: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--gray-500)', alignSelf: 'center' }}>Insert:</span>
              {PLACEHOLDERS.map(ph => (
                <button key={ph} type="button" className="btn btn-ghost btn-sm"
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                  onClick={() => insertPlaceholder(ph)}>
                  {ph}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Hello {name}, this is a message from our company…"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              style={{ minHeight: 120 }}
            />
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
              {form.content.length} characters · ~{Math.ceil(form.content.length / 160)} SMS part{Math.ceil(form.content.length / 160) !== 1 ? 's' : ''}
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Template"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, Delete'}
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>
          Delete template <strong>"{deleteTarget?.name}"</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
