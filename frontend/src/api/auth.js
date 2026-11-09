import { request } from './client';

export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  /** Ends this sign-in on the server, so a copied token stops working too. */
  logout: () => request('/auth/logout', { method: 'POST' }),
};
