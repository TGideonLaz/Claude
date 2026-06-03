import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '../components/Modal.jsx';
import {
  getContacts, getCategories,
  createContact, updateContact, deleteContact, importContacts,
} from '../api.js';

const emptyForm = { name: '', phone: '', email: '', company: '', category_id: '' };

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // CSV Import
  const [importOpen, setImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, cats] = await Promise.all([
        getContacts(filterCat ? { category_id: filterCat } : {}),
        getCategories(),
      ]);
      const list = Array.isArray(c) ? c : c?.contacts || c?.data || [];
      setContacts(list);
      setCategories(Array.isArray(cats) ? cats : cats?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterCat]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  function catName(id) {
    const cat = categories.find(c => String(c.id) === String(id));
    return cat ? cat.name : '—';
  }

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(c) {
    setEditTarget(c);
    setForm({
      name: c.name || '', phone: c.phone || '',
      email: c.email || '', company: c.company || '',
      category_id: c.category_id != null ? String(c.category_id) : '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.phone.trim()) { setFormError('Phone number is required.'); return; }
    const payload = {
      ...form,
      category_id: form.category_id ? Number(form.category_id) : null,
    };
    try {
      setSaving(true);
      setFormError('');
      if (editTarget) {
        await updateContact(editTarget.id, payload);
        setSuccess('Contact updated.');
      } else {
        await createContact(payload);
        setSuccess('Contact added.');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    if (!csvFile) { setImportError('Please select a CSV file.'); return; }
    try {
      setImporting(true);
      setImportError('');
      const fd = new FormData();
      fd.append('file', csvFile);
      const res = await importContacts(fd);
      const count = res?.imported ?? res?.count ?? res?.created ?? '?';
      setSuccess(`Imported ${count} contacts successfully.`);
      setImportOpen(false);
      setCsvFile(null);
      load();
    } catch (e) {
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteContact(deleteTarget.id);
      setSuccess('Contact deleted.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError(e.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = contacts.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Manage all contacts across your categories.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => { setCsvFile(null); setImportError(''); setImportOpen(true); }}>
            📂 Import CSV
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ Add Contact</button>
        </div>
      </div>

      {success && <div className="alert alert-success">✓ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search contacts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', maxWidth: 320 }}
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          style={{ flex: '0 0 auto' }}
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading contacts…</span></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No contacts found</div>
            <div className="empty-state-text">
              {search ? 'Try a different search term.' : 'Add your first contact to get started.'}
            </div>
            {!search && (
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={openCreate}>
                + Add Contact
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Company</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ color: 'var(--gray-400)', width: 40 }}>{i + 1}</td>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.phone}</td>
                  <td style={{ color: 'var(--gray-500)' }}>{c.email || '—'}</td>
                  <td style={{ color: 'var(--gray-500)' }}>{c.company || '—'}</td>
                  <td>
                    {c.category_id
                      ? <span className="tag">{catName(c.category_id)}</span>
                      : <span style={{ color: 'var(--gray-300)', fontStyle: 'italic' }}>None</span>}
                  </td>
                  <td>
                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️ Edit</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setDeleteTarget(c)}
                      >🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', color: 'var(--gray-400)', fontSize: 13 }}>
            Showing {filtered.length} of {contacts.length} contacts
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Contact' : 'Add Contact'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Contact'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Name *</label>
              <input type="text" placeholder="John Doe" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>Phone *</label>
              <input type="tel" placeholder="+254700000000" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" placeholder="john@example.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Company</label>
              <input type="text" placeholder="Acme Ltd" value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">— No category —</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Contacts from CSV"
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setImportOpen(false)} disabled={importing}>Cancel</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={importing || !csvFile}>
              {importing ? 'Importing…' : 'Import Contacts'}
            </button>
          </>
        }
      >
        {importError && <div className="alert alert-error">{importError}</div>}
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <div>
            <strong>CSV Format:</strong> Headers should be{' '}
            <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 3 }}>
              name, phone, email, company, category_id
            </code>
            <br />
            <span style={{ fontSize: 12 }}>Only <em>name</em> and <em>phone</em> are required.</span>
          </div>
        </div>
        <div
          className={`csv-drop-zone${dragActive ? ' active' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) setCsvFile(f); }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={e => setCsvFile(e.target.files[0] || null)}
          />
          <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
          {csvFile ? (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{csvFile.name}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>{(csvFile.size / 1024).toFixed(1)} KB</div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 8 }}
                onClick={e => { e.stopPropagation(); setCsvFile(null); }}
              >✕ Remove</button>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>Drag &amp; drop your CSV here</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>or click to browse files</div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Contact"
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
          Delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.phone})? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
