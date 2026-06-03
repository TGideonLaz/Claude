import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '../components/Modal.jsx';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../api.js';

const PLACEHOLDERS = ['{name}', '{phone}', '{company}', '{email}'];
const emptyForm = { name: '', content: '' };

function samplePreview(body) {
  return (body || '')
    .replace(/{name}/g, 'Jane Doe')
    .replace(/{phone}/g, '+1234567890')
    .replace(/{company}/g, 'Acme Corp')
    .replace(/{email}/g, 'jane@acme.com');
}

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
  const textareaRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [previewTemplate, setPreviewTemplate] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTemplates();
      setTemplates(Array.isArray(data) ? data : data?.templates || data?.data || []);
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
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newContent = form.content.slice(0, start) + ph + form.content.slice(end);
      setForm(f => ({ ...f, content: newContent }));
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + ph.length, start + ph.length);
      }, 0);
    } else {
      setForm(f => ({ ...f, content: f.content + ph }));
    }
  }

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(tmpl) {
    setEditTarget(tmpl);
    setForm({ name: tmpl.name || '', content: tmpl.content || '' });
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

  const smsParts = (len) => Math.max(1, Math.ceil(len / 160));

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
            <div className="empty-state-text">
              Create a template with placeholders like {'{name}'} for personalised messages.
            </div>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={openCreate}>
              + New Template
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {templates.map(tmpl => {
            const usedPhs = PLACEHOLDERS.filter(ph => (tmpl.content || '').includes(ph));
            return (
              <div key={tmpl.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-header">
                  <span className="card-title" style={{ fontSize: 15 }}>{tmpl.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    {tmpl.created_at ? new Date(tmpl.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <div className="card-body" style={{ flex: 1 }}>
                  <div className="template-preview" style={{ marginBottom: 12, minHeight: 60 }}>
                    {tmpl.content || <span style={{ color: 'var(--gray-300)', fontStyle: 'italic' }}>Empty</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                    {usedPhs.length > 0
                      ? usedPhs.map(ph => <span key={ph} className="badge badge-primary">{ph}</span>)
                      : <span className="badge badge-gray">No placeholders</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-400)' }}>
                      {(tmpl.content || '').length} chars · {smsParts((tmpl.content || '').length)} part{smsParts((tmpl.content || '').length) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPreviewTemplate(tmpl)} title="Preview with sample data">
                      👁️ Preview
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tmpl)}>✏️ Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                      onClick={() => setDeleteTarget(tmpl)}>🗑️ Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Template' : 'New Template'}
        size="lg"
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
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--gray-500)', marginRight: 8 }}>Insert placeholder:</span>
              <span className="placeholder-buttons" style={{ display: 'inline-flex' }}>
                {PLACEHOLDERS.map(ph => (
                  <button key={ph} type="button" className="placeholder-btn" onClick={() => insertPlaceholder(ph)}>
                    {ph}
                  </button>
                ))}
              </span>
            </div>
            <textarea
              ref={textareaRef}
              placeholder="Hello {name}, this is a message from our company…"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              style={{ minHeight: 130 }}
            />
            <div className={`char-counter ${form.content.length > 320 ? 'danger' : form.content.length > 160 ? 'warning' : ''}`}>
              {form.content.length} characters · {smsParts(form.content.length)} SMS part{smsParts(form.content.length) !== 1 ? 's' : ''}
            </div>
          </div>
          {form.content && (
            <div className="form-group">
              <label>Live Preview (sample data)</label>
              <div className="message-bubble" style={{ maxWidth: '100%' }}>
                {samplePreview(form.content)}
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title={`Preview: ${previewTemplate?.name || ''}`}
        size="lg"
        footer={
          <button className="btn btn-secondary" onClick={() => setPreviewTemplate(null)}>Close</button>
        }
      >
        {previewTemplate && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 8 }}>Raw Template</div>
              <div className="template-preview">{previewTemplate.content}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 8 }}>
                Rendered with sample contact data
              </div>
              <div className="message-bubble" style={{ maxWidth: '100%' }}>
                {samplePreview(previewTemplate.content)}
              </div>
            </div>
          </div>
        )}
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
