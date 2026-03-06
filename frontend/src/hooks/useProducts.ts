/**
 * useProducts Hook
 * Manages selected product IDs for multi-product filtering
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'selected_product_ids';

interface UseProductsReturn {
  selectedProductIds: number[];
  setProductIds: (ids: number[]) => void;
  toggleProduct: (productId: number) => void;
  clearSelection: () => void;
}

export const useProducts = (): UseProductsReturn => {
  // Initialize with empty array for SSR, then hydrate from localStorage on client
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on client-side mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setSelectedProductIds(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to parse stored product IDs:', error);
      }
      setIsHydrated(true);
    }
  }, []);

  // Persist to localStorage whenever selection changes (only on client)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProductIds));
      } catch (error) {
        console.error('Failed to save product IDs to localStorage:', error);
      }
    }
  }, [selectedProductIds, isHydrated]);

  const setProductIds = (ids: number[]) => {
    setSelectedProductIds(ids);
  };

  const toggleProduct = (productId: number) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const clearSelection = () => {
    setSelectedProductIds([]);
  };

  return {
    selectedProductIds,
    setProductIds,
    toggleProduct,
    clearSelection,
  };
};
