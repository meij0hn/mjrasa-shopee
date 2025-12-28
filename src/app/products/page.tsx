'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import ProductList from '@/components/ProductList';

interface Product {
    item_id: number;
    item_name?: string;
    item_status: string;
    update_time?: number;
}

const PAGE_SIZE = 10;

export default function ProductsPage() {
    const router = useRouter();
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [productsLoading, setProductsLoading] = useState(false);

    const [products, setProducts] = useState<Product[]>([]);
    const [hasMoreProducts, setHasMoreProducts] = useState(false);
    const [totalProducts, setTotalProducts] = useState<number | undefined>(undefined);
    const [productsPage, setProductsPage] = useState(1);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Check auth status
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/status');
                const data = await res.json();
                setIsConnected(data.isConnected);

                if (!data.isConnected) {
                    router.push('/');
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                router.push('/');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [router]);

    // Fetch products with pagination
    const fetchProducts = useCallback(async (page: number = 1) => {
        if (!isConnected) return;

        setProductsLoading(true);
        try {
            const offset = (page - 1) * PAGE_SIZE;
            const res = await fetch(`/api/products?offset=${offset}&page_size=${PAGE_SIZE}`);
            const data = await res.json();
            if (data.response?.item) {
                setProducts(data.response.item);
                setHasMoreProducts(data.response.has_next_page);
                setTotalProducts(data.response.total_count);
            }
        } catch (error) {
            console.error('Products fetch failed:', error);
            setMessage({ type: 'error', text: '❌ Failed to load products' });
        } finally {
            setProductsLoading(false);
        }
    }, [isConnected]);

    // Initial data fetch
    useEffect(() => {
        if (isConnected) {
            fetchProducts(1);
        }
    }, [isConnected, fetchProducts]);

    // Handle products page change
    const handleProductsPageChange = (page: number) => {
        setProductsPage(page);
        fetchProducts(page);
    };

    // Handle logout
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/status', { method: 'DELETE' });
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    // Handle stock update - refresh products
    const handleStockUpdate = () => {
        fetchProducts(productsPage);
    };

    if (loading) {
        return (
            <>
                <Navbar isConnected={false} />
                <div className="app-layout">
                    <Sidebar isConnected={false} />
                    <main className="main-content">
                        <div className="loading-container" style={{ minHeight: '60vh' }}>
                            <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
                            <span>Loading...</span>
                        </div>
                    </main>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar isConnected={isConnected} onLogout={handleLogout} />

            <div className="app-layout">
                <Sidebar isConnected={isConnected} />

                <main className="main-content">
                    {message && (
                        <div className={`message message-${message.type}`} style={{ marginBottom: '1rem' }}>
                            {message.text}
                        </div>
                    )}

                    <section className="dashboard">
                        <div className="dashboard-header">
                            <h1>📦 Products</h1>
                            <p>Manage your Shopee products and inventory.</p>
                        </div>

                        <ProductList
                            products={products}
                            loading={productsLoading}
                            hasMore={hasMoreProducts}
                            currentPage={productsPage}
                            totalItems={totalProducts}
                            pageSize={PAGE_SIZE}
                            onPageChange={handleProductsPageChange}
                            onStockUpdate={handleStockUpdate}
                        />
                    </section>

                    <footer className="footer">
                        <p>Shopee Seller Hub © 2025 for Shopee sellers.</p>
                    </footer>
                </main>
            </div>
        </>
    );
}
