const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    const raw = await response.text().catch(() => '');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        message = parsed.error || parsed.message || message;
      } catch (error) {
        if (!raw.trim().startsWith('<')) {
          message = raw;
        }
      }
    }
    throw new Error(message);
  }

  return response.json();
}

export function getUsers(role) {
  const query = role ? `?role=${role}` : '';
  return request(`/api/users${query}`);
}

export function getConsultations({ userId, role }) {
  return request(`/api/consultations?userId=${userId}&role=${role}`);
}

export function createConsultation({ patientId }) {
  return request('/api/consultations', {
    method: 'POST',
    body: JSON.stringify({ patientId })
  });
}

export function signUp({ username, password }) {
  return request('/api/signup', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export function login({ username, password }) {
  return request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export function submitConsultation({ id, doctorId }) {
  return request(`/api/consultations/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ doctorId })
  });
}

export function closeConsultation({ id }) {
  return request(`/api/consultations/${id}/close`, {
    method: 'POST'
  });
}

export function deleteConsultation({ id }) {
  return request(`/api/consultations/${id}`, {
    method: 'DELETE'
  });
}

export function listMessages({ id }) {
  return request(`/api/consultations/${id}/messages`);
}

export function sendMessage({ id, senderId, senderRole, content }) {
  return request(`/api/consultations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ senderId, senderRole, content })
  });
}

export function requestAiResponse({ id, patientId, complaint }) {
  return request(`/api/consultations/${id}/ai`, {
    method: 'POST',
    body: JSON.stringify({ patientId, complaint })
  });
}

export function getAiMeta() {
  return request('/api/ai/meta');
}

export { API_BASE };
