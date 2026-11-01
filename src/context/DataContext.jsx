import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { productsApi } from '../api/products';
import { purchasesApi } from '../api/purchases';
import { customersApi } from '../api/customers';
import { sellersApi } from '../api/sellers';
import { salesApi } from '../api/sales';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [sellers, setSellers] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    return Promise.all([productsApi.list(), purchasesApi.list(), customersApi.list(), salesApi.list(), sellersApi.list()])
      .then(([pr, pu, cu, sa, se]) => {
        setProducts(pr);
        setPurchases(pu);
        setCustomers(cu);
        setSales(sa);
        setSellers(se);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => {
    // Shows the server's message as a toast and rethrows so the calling form can stay open.
    const guard =
      (fn) =>
      async (...args) => {
        try {
          return await fn(...args);
        } catch (err) {
          setToast(err.message);
          throw err;
        }
      };

    return {
      loading,
      products,
      purchases,
      customers,
      sales,
      sellers,
      addSeller: guard(async (s) => {
        const created = await sellersApi.create(s);
        setSellers((prev) => [created, ...prev]);
        return created;
      }),
      updateSeller: guard(async (id, s) => {
        const updated = await sellersApi.update(id, s);
        setSellers((prev) => prev.map((x) => (x.id === id ? updated : x)));
      }),
      deleteSeller: guard(async (id) => {
        await sellersApi.remove(id);
        setSellers((prev) => prev.filter((x) => x.id !== id));
      }),
      addProduct: guard(async (p) => {
        const created = await productsApi.create(p);
        setProducts((prev) => [created, ...prev]);
        return created;
      }),
      updateProduct: guard(async (id, p) => {
        const updated = await productsApi.update(id, p);
        setProducts((prev) => prev.map((x) => (x.id === id ? updated : x)));
      }),
      deleteProduct: guard(async (id) => {
        await productsApi.remove(id);
        setProducts((prev) => prev.filter((x) => x.id !== id));
      }),
      addPurchase: guard(async (p) => {
        const created = await purchasesApi.create(p);
        setPurchases((prev) => [created, ...prev]);
      }),
      deletePurchase: guard(async (id) => {
        await purchasesApi.remove(id);
        setPurchases((prev) => prev.filter((x) => x.id !== id));
      }),
      addCustomer: guard(async (c) => {
        const created = await customersApi.create(c);
        setCustomers((prev) => [created, ...prev]);
        return created;
      }),
      updateCustomer: guard(async (id, c) => {
        const updated = await customersApi.update(id, c);
        setCustomers((prev) => prev.map((x) => (x.id === id ? updated : x)));
      }),
      deleteCustomer: guard(async (id) => {
        await customersApi.remove(id);
        setCustomers((prev) => prev.filter((x) => x.id !== id));
      }),
      addSale: guard(async (s) => {
        const created = await salesApi.create(s);
        setSales((prev) => [created, ...prev]);
        return created;
      }),
      deleteSale: guard(async (id) => {
        await salesApi.remove(id);
        setSales((prev) => prev.filter((x) => x.id !== id));
      }),
    };
  }, [loading, products, purchases, customers, sales, sellers]);

  if (loadError) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800">Could not load data</h2>
        <p className="mt-2 text-sm text-red-700">{loadError}</p>
        <button onClick={load} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          Try again
        </button>
      </div>
    );
  }

  return (
    <DataContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-[60] flex max-w-sm items-start gap-3 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-lg"
        >
          <span className="flex-1">{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss" className="text-red-400 hover:text-red-600">
            x
          </button>
        </div>
      )}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
