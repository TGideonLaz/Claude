import { useState, useEffect } from 'react';
import { getCategories, getTemplates, sendSMS } from '../api.js';

const PLACEHOLDERS = ['{name}', '{phone}', '{company}', '{email}'];

export default function SendSMS() {
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedCats, setSelectedCats] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getCategories(), getTemplates()])
      .then(([cats, tmps]) => {
        setCategories(Array.isArray(cats) ? cats : cats?.data || []);
        setTemplates(Array.isArray(tmps) ? tmps : tmps?.data || []);
      })
      .catch(e => setError(e.message));
  }, []);

  function toggleCat(id) {
    setSelectedCats(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  function applyTemplate(id) {
    setTemplateId(id);
    if (!id) return;
    const tmpl = templates.find(t => String(t.id) === String(id));
    if (tmpl) setMessage(tmpl.content);
  }

  function insertPlaceholder(ph) {
    setMessage(m => m + ph);
  }

  const recipientCount = selectedCats.length === 0
    ? categories.reduce((sum, c) => sum + (c.contact_count || 0), 0)
    : selectedCats.reduce((sum, id) => {
        const cat = categories.find(c => c.id === id);
        return sum + (cat?.contact_count || 0);
      }, 0);

  async function handleSend(e) {
    e.preventDefault();
    if (!message.trim()) { setError('Message is required.'); return; }
    setError('');
    setResult(null);
    setSending(true);
    try {
      const payload = {
        message,
        category_ids: selectedCats,
      };
      if (templateId) payload.template_id = Number(templateId);
      const data = await sendSMS(payload);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  const smsParts = Math.ceil((message.length || 1) / 160);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Send Bulk SMS</h1>
          <p className="page-subtitle">Compose and send a message to one or more contact categories.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      {result && (
        <div className={`alert ${result.log?.status === 'failed' ? 'alert-error' : 'alert-success'}`}
          style={{ marginBottom: 16 }}>
          <strong>
            {result.log?.status === 'success' && '✓ All messages sent successfully!'}
            {result.log?.status === 'partial' && `⚠️ Partially sent — ${result.log.successful} succeeded, ${result.log.failed} failed.`}
            {result.log?.status === 'failed' && '✗ Send failed — no messages were delivered.'}
          </strong>
          {result.failed_recipients?.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13 }}>Failed recipients ({result.failed_recipients.length})</summary>
              <ul style={{ marginTop: 6, fontSize: 12, paddingLeft: 16 }}>
                {result.failed_recipients.map((r, i) => (
                  <li key={i}>{r.recipient}: {r.error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        <form onSubmit={handleSend}>
          {/* Template Picker */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Message Template (optional)</span></div>
            <div style={{ padding: '16px 24px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <select value={templateId} onChange={e => applyTemplate(e.target.value)}>
                  <option value="">— Type a custom message —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Message Composer */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Message</span></div>
            <div style={{ padding: '16px 24px' }}>
            <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Personalise:</span>
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
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{ minHeight: 140, width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>
              <span>{message.length} characters</span>
              <span>{smsParts} SMS part{smsParts !== 1 ? 's' : ''} per recipient</span>
            </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !message.trim() || recipientCount === 0}
            style={{ width: '100%', padding: '12px 0', fontSize: 16 }}
          >
            {sending
              ? 'Sending…'
              : `Send to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`}
          </button>
        </form>

        {/* Category Selector */}
        <div className="card" style={{ position: 'sticky', top: 24 }}>
          <div className="card-header"><span className="card-title">Target Audience</span></div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '0 0 12px' }}>
            {selectedCats.length === 0
              ? 'All contacts will receive this message.'
              : `${selectedCats.length} categor${selectedCats.length === 1 ? 'y' : 'ies'} selected.`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '8px 10px', borderRadius: 8,
              background: selectedCats.length === 0 ? 'var(--primary-light)' : 'transparent',
              fontWeight: selectedCats.length === 0 ? 600 : 400,
            }}>
              <input
                type="checkbox"
                checked={selectedCats.length === 0}
                onChange={() => setSelectedCats([])}
                style={{ accentColor: 'var(--primary)' }}
              />
              <span>All contacts</span>
              <span className="badge badge-primary" style={{ marginLeft: 'auto' }}>
                {categories.reduce((s, c) => s + (c.contact_count || 0), 0)}
              </span>
            </label>
            <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 8 }}>
              {categories.map(cat => (
                <label key={cat.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '8px 10px', borderRadius: 8,
                  background: selectedCats.includes(cat.id) ? 'var(--primary-light)' : 'transparent',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedCats.includes(cat.id)}
                    onChange={() => toggleCat(cat.id)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span style={{ flex: 1 }}>{cat.name}</span>
                  <span className="badge" style={{ marginLeft: 'auto' }}>{cat.contact_count || 0}</span>
                </label>
              ))}
            </div>
          </div>
          {recipientCount > 0 && (
            <div style={{
              marginTop: 16, padding: 12, background: 'var(--gray-50)',
              borderRadius: 8, fontSize: 13, color: 'var(--gray-600)', textAlign: 'center',
            }}>
              <strong style={{ color: 'var(--primary)', fontSize: 18 }}>{recipientCount}</strong> recipient{recipientCount !== 1 ? 's' : ''} will receive this message
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
