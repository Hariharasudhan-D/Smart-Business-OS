import { request } from './client';

// Delivered cake orders from the website (read-only; managed on the website).
export const websiteSalesApi = {
  list: () => request('/website-sales'),
};
