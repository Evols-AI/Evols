/**
 * ProductSelector Component
 * Multi-select dropdown for filtering by products
 */

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Plus, X } from 'lucide-react';
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
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { selectedProductIds, toggleProduct, setProductIds } = useProducts();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current user to check if they can create products
  const currentUser = getCurrentUser();

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
    setShowAddProductModal(true);
  };

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) {
      alert('Please enter a product name');
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.products.create({
        name: newProductName.trim(),
        description: newProductDescription.trim() || undefined,
        is_demo: false
      });

      // Close modal and reset form
      setShowAddProductModal(false);
      setNewProductName('');
      setNewProductDescription('');

      // Reload products
      await loadProducts();

      // Auto-select the newly created product
      setProductIds([response.id]);

      // Reload page to refresh data with new product
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to create product:', error);
      alert(error.response?.data?.detail || 'Failed to create product. Please try again.');
    } finally {
      setIsCreating(false);
    }
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
      <div className="flex items-center gap-2 px-4 py-2 bg-input border border-border rounded-md">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-input border border-border rounded-md hover:bg-muted transition-colors"
        aria-label="Select products"
      >
        <span className="text-sm font-medium text-foreground">
          {getDisplayText()}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            {/* All Products option (excludes demo) */}
            <button
              onClick={handleAllProducts}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors text-left"
            >
              <span className="text-sm font-medium text-foreground">
                All Products (no demo)
              </span>
            </button>

            <div className="border-t border-border my-2" />

            {/* Individual products */}
            {products.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No products available
              </div>
            ) : (
              products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleToggle(product.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors"
                >
                  <div className="w-4 h-4 border border-border rounded flex items-center justify-center flex-shrink-0">
                    {selectedProductIds.includes(product.id) && (
                      <Check className="w-3 h-3 text-primary" />
                    )}
                  </div>
                  <span className="text-sm flex-1 text-left text-foreground">
                    {product.name}
                    {product.is_demo && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (Demo)
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}

            {/* Add Product button - only show for admins */}
            {currentUser?.role === 'TENANT_ADMIN' || currentUser?.role === 'PRODUCT_ADMIN' ? (
              <>
                <div className="border-t border-border my-2" />
                <button
                  onClick={handleAddProduct}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/5 dark:hover:bg-primary/10 rounded transition-colors text-primary dark:text-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Add Product</span>
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddProductModal(false);
              setNewProductName('');
              setNewProductDescription('');
            }
          }}
        >
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="page-title text-foreground">
                  Add New Product
                </h2>
                <button
                  onClick={() => {
                    setShowAddProductModal(false);
                    setNewProductName('');
                    setNewProductDescription('');
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g., Mobile App, Enterprise Platform"
                    className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-transparent"
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={newProductDescription}
                    onChange={(e) => setNewProductDescription(e.target.value)}
                    placeholder="Brief description of this product..."
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-transparent resize-none"
                    disabled={isCreating}
                  />
                </div>

                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-md p-3">
                  <p className="text-xs text-primary/85 dark:text-primary">
                    💡 Products define the scope for knowledge, personas, and workbench conversations.
                    You can add product-specific context in the Knowledge tab after creation.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddProductModal(false);
                    setNewProductName('');
                    setNewProductDescription('');
                  }}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProduct}
                  disabled={isCreating || !newProductName.trim()}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary/85 text-primary-foreground rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Product'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
