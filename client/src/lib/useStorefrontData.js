import { useState, useEffect } from 'react';
import api from './api';

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
  const services = data?.services ?? [];
  const categories = data?.categories ?? [];
  const packages = data?.packages ?? [];
  const bundles = data?.industryBundles ?? [];
  const addons = data?.addons ?? [];
  const meta = data?.meta ?? {};
  return { services, categories, packages, bundles, addons, meta, data, loading, error };
}
