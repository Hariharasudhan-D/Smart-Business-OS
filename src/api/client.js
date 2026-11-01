// Single place that talks to the Java backend. Every src/api/<entity>.js builds on this.
// In dev the Vite server proxies /api to http://localhost:8080 (see vite.config.js).
// For a deployed build set VITE_API_URL, e.g. https://my-backend.example.com/api
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // response had no JSON body; keep the generic message
    }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

export function createRestApi(resource) {
  return {
    list: () => request(`/${resource}`),
    create: (input) => request(`/${resource}`, { method: 'POST', body: JSON.stringify(input) }),
    update: (id, patch) => request(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id) => request(`/${resource}/${id}`, { method: 'DELETE' }),
  };
}
