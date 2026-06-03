import { useState, useEffect, useCallback } from 'react';
import Modal from '../components/Modal.jsx';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../api.js';

const emptyForm = { name: '', description: '' };

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create mode
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getCategories();
      const list = Array.isArray(data) ? data : data?.categories || data?.data || [];
      setCategories(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(cat) {
    setEditTarget(cat);
    setForm({ name: cat.name || '', description: cat.description || '' });
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Category name is required.');
      return;
    }
    try {
      setSaving(true);
      setFormError('');
      if (editTarget) {
        await updateCategory(editTarget.id, form);
        setSuccess('Category updated successfully.');
      } else {
        await createCategory(form);
        setSuccess('Category created successfully.');
      }
      closeModal();
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
      await deleteCategory(deleteTarget.id);
      setSuccess('Category deleted.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError(e.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Organise your contacts into groups for targeted messaging.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Add Category
        </button>
      </div>

      {success && <div className="alert alert-success">✓ {success}</div>}
      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading categories…</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🏷️</div>
            <div className="empty-state-title">No categories yet</div>
            <div className="empty-state-text">
              Create your first category to start organising contacts.
            </div>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={openCreate}>
              + Add Category
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Description</th>
                <th>Contacts</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, i) => (
                <tr key={cat.id}>
                  <td style={{ color: 'var(--gray-400)', width: 40 }}>{i + 1}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{cat.name}</span>
                  </td>
                  <td style={{ color: 'var(--gray-500)' }}>
                    {cat.description || <span style={{ fontStyle: 'italic', color: 'var(--gray-300)' }}>No description</span>}
                  </td>
                  <td>
                    <span className="badge badge-primary">
                      {cat.contact_count ?? 0} contacts
                    </span>
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>
                    {cat.created_at
                      ? new Date(cat.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td>
                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(cat)}
                        title="Edit"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setDeleteTarget(cat)}
                        title="Delete"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Category' : 'Add Category'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Category'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="form-group">
            <label htmlFor="cat-name">Category Name *</label>
            <input
              id="cat-name"
              type="text"
              placeholder="e.g. VIP Clients"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="cat-desc">Description</label>
            <textarea
              id="cat-desc"
              placeholder="Optional description…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={{ minHeight: 80 }}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Category"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, Delete'}
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>
          Are you sure you want to delete the category{' '}
          <strong style={{ color: 'var(--gray-900)' }}>"{deleteTarget?.name}"</strong>?
          {(deleteTarget?.contactCount ?? 0) > 0 && (
            <span>
              {' '}This category has{' '}
              <strong>{deleteTarget.contactCount}</strong> contacts — they will not be deleted,
              only unlinked from this category.
            </span>
          )}
        </p>
      </Modal>
    </div>
  );
}
