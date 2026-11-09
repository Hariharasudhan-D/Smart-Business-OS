import { request } from './client';

/** Sales, purchases and profit for a date range. The server calculates it, so the phone app shows the same numbers. */
export const reportApi = {
  get: (from, to, group = 'none') => request(`/report?from=${from}&to=${to}&group=${group}`),
};
