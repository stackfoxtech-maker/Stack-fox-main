import { useState, useEffect, useMemo } from 'react';
import api from './api';

// Stable references so consumers that put these arrays in effect/memo deps
// don't re-run on every render while the fetch is in flight.
const EMPTY_ARR = Object.freeze([]);
const EMPTY_OBJ = Object.freeze({});

// Session-level cache: the storefront catalogue (~90 KB) is requested from the
// Navbar search, the Catalog page, Packages, ServiceCost, ServiceTimeline… —
// this makes it one request per page load no matter how many consumers mount.
let cachePromise = null;
let cacheValue = null;

function fetchStorefront() {
  if (cacheValue) return Promise.resolve(cacheValue);
  if (!cachePromise) {
    cachePromise = api.get('/catalogue/storefront')
      .then((r) => { cacheValue = r.data; return cacheValue; })
      .catch((err) => { cachePromise = null; throw err; });
  }
  return cachePromise;
}

export function useStorefrontData() {
  const [data, setData] = useState(cacheValue);
  const [loading, setLoading] = useState(!cacheValue);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cacheValue) return;
    let cancelled = false;
    fetchStorefront()
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

export function useCatalogue() {
  const { data, loading, error } = useStorefrontData();
  return useMemo(() => ({
    services: data?.services ?? EMPTY_ARR,
    categories: data?.categories ?? EMPTY_ARR,
    packages: data?.packages ?? EMPTY_ARR,
    bundles: data?.industryBundles ?? EMPTY_ARR,
    addons: data?.addons ?? EMPTY_ARR,
    meta: data?.meta ?? EMPTY_OBJ,
    data, loading, error,
  }), [data, loading, error]);
}
