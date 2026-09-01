import { useState, useEffect, useMemo } from 'react';
import api from './api';

// Stable references so consumers that put these arrays in effect/memo deps
// don't re-run on every render while the fetch is in flight.
const EMPTY_ARR = Object.freeze([]);
const EMPTY_OBJ = Object.freeze({});

export function useStorefrontData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get('/catalogue/storefront')
      .then((r) => {
        if (!cancelled) {
          setData(r.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });
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
