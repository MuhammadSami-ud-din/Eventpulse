import { useCallback, useEffect, useState } from 'react';
import { isAbortError } from '../utils/errors.js';

// Runs `load(signal)` whenever `deps` change and tracks its result.
// - A newer run aborts the older one, so a slow search can't overwrite a fast one.
// - Data from the previous run stays visible while reloading (no flicker when
//   polling or typing); `isLoading` is only true before the first result.
export function useAsync(load, deps) {
  const [state, setState] = useState({ data: null, error: null, isFetching: true });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, isFetching: true }));
    load(controller.signal).then(
      (data) => setState({ data, error: null, isFetching: false }),
      (error) => {
        if (!isAbortError(error)) setState((current) => ({ ...current, error, isFetching: false }));
      },
    );
    return () => controller.abort();
    // `load` is recreated every render, so it is deliberately not a dependency;
    // the caller's `deps` say when it really changed.
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const setData = useCallback((data) => setState((current) => ({ ...current, data })), []);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isFetching && state.data === null && state.error === null,
    isFetching: state.isFetching,
    reload,
    setData,
  };
}
