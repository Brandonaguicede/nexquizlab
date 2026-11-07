import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { messageOf } from './format';
/**
 * Loads data when `deps` change or reload() is called. A superseded or unmounted request is aborted and never
 * touches state. Callers leave the access token out of `deps`: it rotates every few minutes and refetching would
 * unmount open forms. `load` returning null skips the request.
 */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T> | null, deps: DependencyList, fallback: string) {
 const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
 useEffect(() => {
  const controller = new AbortController(), request = load(controller.signal);
  if (!request) return;
  setLoading(true); setError('');
  request.then(value => { if (!controller.signal.aborted) setData(value); }, cause => { if (!controller.signal.aborted) setError(messageOf(cause, fallback)); })
   .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [...deps, revision]);
 const reload = useCallback(() => setRevision(value => value + 1), []);
 return { data, setData, error, loading, reload };
}
/** Object URL of an authenticated image (Bearer fetch → Blob), revoked when the source changes or on unmount. */
export function useBlobUrl(load: ((signal: AbortSignal) => Promise<Blob>) | null, deps: DependencyList) {
 const [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
 useEffect(() => {
  setUrl(''); setFailed(false);
  if (!load) return;
  const controller = new AbortController(); let objectUrl = '';
  load(controller.signal).then(blob => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }, () => { if (!controller.signal.aborted) setFailed(true); });
  return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
 }, deps);
 return { url, failed };
}
