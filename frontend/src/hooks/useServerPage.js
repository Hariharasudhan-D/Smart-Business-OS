import { useEffect, useRef, useState } from 'react';
import { request } from '../api/client';

/** The typed search, sent to the server only after typing pauses (so each key press is not a request). */
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * One page of a list, read from the server: only the rows on screen are downloaded, and search runs
 * on the server. `page` starts at 1 (as the Pagination control counts). `reloadKey` refetches the page
 * when it changes, e.g. after a sale is added or deleted. The previous rows stay visible while the
 * next page loads, so paging never flashes an empty table.
 */
export function useServerPage(path, { page, size, q }, reloadKey) {
  const [state, setState] = useState({ rows: [], total: 0, loading: true, error: '' });
  const latest = useRef(0);

  useEffect(() => {
    const call = ++latest.current;
    const params = new URLSearchParams({ page: String(page - 1), size: String(size) });
    if (q && q.trim()) params.set('q', q.trim());
    setState((s) => ({ ...s, loading: true, error: '' }));
    request(`${path}?${params}`)
      .then((r) => call === latest.current && setState({ rows: r.items, total: r.total, loading: false, error: '' }))
      .catch((err) => call === latest.current && setState((s) => ({ ...s, loading: false, error: err.message })));
  }, [path, page, size, q, reloadKey]);

  return state;
}
