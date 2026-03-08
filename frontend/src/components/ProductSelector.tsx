/**
 * ProductSelector Component
 * Multi-select dropdown for filtering by products
 */

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { api } from '../services/api';
import { getCurrentUser } from '@/utils/auth';

interface Product {
  id: number;
  name: string;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
}

export const ProductSelector: React.FC = () => {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const { selectedProductIds, toggleProduct, setProductIds } = useProducts();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    loadProducts();
  }, []);

  useEffect(() => {
    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const data = await api.products.list();
      setProducts(data);

      // Auto-select Demo product ONLY on first-ever load for this tenant (localStorage is null)
      // Don't auto-select if user has explicitly cleared selection (localStorage is "[]")
      // Only check localStorage on client-side
      if (typeof window !== 'undefined') {
        const user = getCurrentUser();
        const tenantId = user?.tenant_id || 'global';
        const storageKey = `selected_product_ids_tenant_${tenantId}`;
        const stored = localStorage.getItem(storageKey);
        const hasEverSelectedProducts = stored !== null;

        if (!hasEverSelectedProducts && data.length > 0) {
          const demoProduct = data.find((p: Product) => p.is_demo);
          if (demoProduct) {
            setProductIds([demoProduct.id]);
            // Reload page to ensure all components see the selected product
            setTimeout(() => {
              window.location.reload();
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAllProducts = () => {
    // Select all non-demo products
    const nonDemoIds = products.filter((p) => !p.is_demo).map((p) => p.id);
    setProductIds(nonDemoIds);
    setIsOpen(false);
    // Full page reload to refresh data
    window.location.reload();
  };

  const handleToggle = (productId: number) => {
    toggleProduct(productId);
    // Full page reload to refresh data
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleAddProduct = () => {
    setIsOpen(false);
    router.push('/knowledge-base');
  };

  const getDisplayText = () => {
    if (selectedProductIds.length === 0) return 'Select Products';
    if (selectedProductIds.length === 1) {
      const product = products.find((p) => p.id === selectedProductIds[0]);
      return product?.name || 'Select Products';
    }
    return `${selectedProductIds.length} Products`;
  };

  // Prevent hydration mismatch by not rendering until mounted on client
  if (!isMounted || isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="Select products"
      >
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {getDisplayText()}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            {/* All Products option (excludes demo) */}
            <button
              onClick={handleAllProducts}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                All Products (no demo)
              </span>
            </button>

            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* Individual products */}
            {products.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No products available
              </div>
            ) : (
              products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleToggle(product.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <div className="w-4 h-4 border border-gray-300 dark:border-gray-600 rounded flex items-center justify-center flex-shrink-0">
                    {selectedProductIds.includes(product.id) && (
                      <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <span className="text-sm flex-1 text-left text-gray-900 dark:text-white">
                    {product.name}
                    {product.is_demo && (
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                        (Demo)
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}

            {/* Add Product button */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
            <button
              onClick={handleAddProduct}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors text-indigo-600 dark:text-indigo-400"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Product</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
