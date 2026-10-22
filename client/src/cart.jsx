import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const KEY = 'jagatha-cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const api = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPaise = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
    return {
      items,
      count,
      totalPaise,
      add(item) {
        setItems((current) => {
          const found = current.find((entry) => entry.variantId === item.variantId);
          const cap = Number.isInteger(item.stockQty) ? Math.min(20, item.stockQty) : 20;
          if (found) {
            const stockCap = Number.isInteger(found.stockQty) ? Math.min(20, found.stockQty) : cap;
            return current.map((entry) => (
              entry.variantId === item.variantId
                ? {
                  ...entry,
                  quantity: Math.min(stockCap, entry.quantity + item.quantity),
                  stockQty: Number.isInteger(item.stockQty) ? item.stockQty : entry.stockQty,
                  grams: Number.isInteger(item.grams) ? item.grams : entry.grams,
                }
                : entry
            ));
          }
          return [...current, { ...item, quantity: Math.min(cap, item.quantity) }];
        });
      },
      setQty(variantId, quantity) {
        setItems((current) => current.flatMap((entry) => {
          if (entry.variantId !== variantId) return [entry];
          if (quantity < 1) return [];
          const cap = Number.isInteger(entry.stockQty) ? Math.min(20, entry.stockQty) : 20;
          return [{ ...entry, quantity: Math.min(cap, quantity) }];
        }));
      },
      remove(variantId) {
        setItems((current) => current.filter((entry) => entry.variantId !== variantId));
      },
      clear() {
        setItems([]);
      },
    };
  }, [items]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
