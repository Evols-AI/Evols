/**
 * useProducts Hook
 * Manages selected product IDs for multi-product filtering
 * Storage is tenant-specific to avoid conflicts between tenants
 */

import { useState, useEffect } from 'react';
import { getCurrentUser } from '@/utils/auth';

interface UseProductsReturn {
  selectedProductIds: number[];
  setProductIds: (ids: number[]) => void;
  toggleProduct: (productId: number) => void;
  clearSelection: () => void;
}

// Get tenant-specific storage key
const getStorageKey = (): string => {
  const user = getCurrentUser();
  const tenantId = user?.tenant_id || 'global';
  return `selected_product_ids_tenant_${tenantId}`;
};

export const useProducts = (): UseProductsReturn => {
  // Initialize with empty array for SSR, then hydrate from localStorage on client
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on client-side mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storageKey = getStorageKey();
        const stored = localStorage.getItem(storageKey);
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
        const storageKey = getStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(selectedProductIds));
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
