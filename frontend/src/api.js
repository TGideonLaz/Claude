const BASE_URL = '/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  if (config.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const res = await fetch(url, config);

  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const message = (data && data.message) || (data && data.error) || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data;
}

// ===== Categories =====
export const getCategories = () => request('/categories');
export const createCategory = (body) => request('/categories', { method: 'POST', body });
export const updateCategory = (id, body) => request(`/categories/${id}`, { method: 'PUT', body });
export const deleteCategory = (id) => request(`/categories/${id}`, { method: 'DELETE' });

// ===== Contacts =====
export const getContacts = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/contacts${qs ? '?' + qs : ''}`);
};
export const createContact = (body) => request('/contacts', { method: 'POST', body });
export const updateContact = (id, body) => request(`/contacts/${id}`, { method: 'PUT', body });
export const deleteContact = (id) => request(`/contacts/${id}`, { method: 'DELETE' });
export const importContacts = (formData) =>
  request('/contacts/import', { method: 'POST', body: formData });

// ===== Templates =====
export const getTemplates = () => request('/templates');
export const createTemplate = (body) => request('/templates', { method: 'POST', body });
export const updateTemplate = (id, body) => request(`/templates/${id}`, { method: 'PUT', body });
export const deleteTemplate = (id) => request(`/templates/${id}`, { method: 'DELETE' });

// ===== SMS =====
export const sendSMS = (body) => request('/sms/send', { method: 'POST', body });
export const getSMSLogs = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/sms/logs${qs ? '?' + qs : ''}`);
};

// ===== Dashboard Stats =====
export const getDashboardStats = () => request('/dashboard/stats');
