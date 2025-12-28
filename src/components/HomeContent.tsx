'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import ShopInfo from '@/components/ShopInfo';
import ProductList from '@/components/ProductList';
import OrderList from '@/components/OrderList';

interface ShopData {
    shop_name?: string;
    region?: string;
    status?: string;
    is_cb?: boolean;
}

interface Product {
    item_id: number;
    item_status: string;
    update_time?: number;
}

interface Order {
    order_sn: string;
    order_status: string;
    create_time?: number;
}

const PAGE_SIZE = 5;

export default function HomeContent() {
    const searchParams = useSearchParams();
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [shopLoading, setShopLoading] = useState(false);
    const [productsLoading, setProductsLoading] = useState(false);
    const [ordersLoading, setOrdersLoading] = useState(false);

    const [shop, setShop] = useState<ShopData | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [hasMoreProducts, setHasMoreProducts] = useState(false);
    const [hasMoreOrders, setHasMoreOrders] = useState(false);
    const [totalProducts, setTotalProducts] = useState<number | undefined>(undefined);

    // Pagination state
    const [productsPage, setProductsPage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
    const [ordersCursor, setOrdersCursor] = useState<string | undefined>(undefined);
    const [ordersCursorHistory, setOrdersCursorHistory] = useState<string[]>([]);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Check URL params for messages
    useEffect(() => {
        const connected = searchParams.get('connected');
        const error = searchParams.get('error');

        if (connected === 'true') {
            setMessage({ type: 'success', text: '✅ Successfully connected to Shopee!' });
        } else if (error) {
            setMessage({ type: 'error', text: `❌ Error: ${error}` });
        }

        // Clear message after 5 seconds
        const timer = setTimeout(() => setMessage(null), 5000);
        return () => clearTimeout(timer);
    }, [searchParams]);

    // Check auth status
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/status');
                const data = await res.json();
                setIsConnected(data.isConnected);
            } catch (error) {
                console.error('Auth check failed:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Fetch shop info once when connected
    const fetchShopInfo = useCallback(async () => {
        if (!isConnected) return;

        setShopLoading(true);
        try {
            const res = await fetch('/api/shop');
            const data = await res.json();

            if (data.response) {
                setShop(data.response);
            } else if (data.shop_name) {
                setShop(data);
            } else if (data.error) {
                console.error('Shop API error:', data.error, data.message);
            }
        } catch (error) {
            console.error('Shop fetch failed:', error);
        } finally {
            setShopLoading(false);
        }
    }, [isConnected]);

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
        } finally {
            setProductsLoading(false);
        }
    }, [isConnected]);

    // Fetch orders with pagination
    const fetchOrders = useCallback(async (page: number = 1, cursor?: string) => {
        if (!isConnected) return;

        setOrdersLoading(true);
        try {
            let url = `/api/orders?page_size=${PAGE_SIZE}`;
            if (cursor) {
                url += `&cursor=${cursor}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            if (data.response?.order_list) {
                setOrders(data.response.order_list);
                setHasMoreOrders(data.response.more);
                // Store the next cursor if available
                if (data.response.next_cursor) {
                    setOrdersCursor(data.response.next_cursor);
                }
            } else if (data.order_list) {
                setOrders(data.order_list);
                setHasMoreOrders(data.more);
            }
        } catch (error) {
            console.error('Orders fetch failed:', error);
        } finally {
            setOrdersLoading(false);
        }
    }, [isConnected]);

    // Initial data fetch
    useEffect(() => {
        if (isConnected) {
            fetchShopInfo();
            fetchProducts(1);
            fetchOrders(1);
        }
    }, [isConnected, fetchShopInfo, fetchProducts, fetchOrders]);

    // Handle products page change
    const handleProductsPageChange = (page: number) => {
        setProductsPage(page);
        fetchProducts(page);
    };

    // Handle orders page change
    const handleOrdersPageChange = (page: number) => {
        if (page > ordersPage) {
            // Going forward - store current cursor in history
            if (ordersCursor) {
                setOrdersCursorHistory(prev => [...prev, ordersCursor]);
            }
            setOrdersPage(page);
            fetchOrders(page, ordersCursor);
        } else if (page < ordersPage) {
            // Going backward - pop cursor from history
            const newHistory = [...ordersCursorHistory];
            newHistory.pop();
            const prevCursor = newHistory[newHistory.length - 1];
            setOrdersCursorHistory(newHistory);
            setOrdersPage(page);
            fetchOrders(page, prevCursor);
        }
    };

    // Handle logout
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/status', { method: 'DELETE' });
            setIsConnected(false);
            setShop(null);
            setProducts([]);
            setOrders([]);
            setProductsPage(1);
            setOrdersPage(1);
            setMessage({ type: 'success', text: '👋 Logged out successfully' });
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
                <main className="container">
                    <div className="loading-container" style={{ minHeight: '60vh' }}>
                        <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
                        <span>Loading...</span>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <Navbar isConnected={isConnected} onLogout={handleLogout} />

            {!isConnected ? (
                <main className="container">
                    {message && (
                        <div className={`message message-${message.type}`} style={{ marginTop: '1rem' }}>
                            {message.text}
                        </div>
                    )}

                    {/* Hero section for unauthenticated users */}
                    <section className="hero">
                        <h1>Shopee Seller Hub</h1>
                        <p>
                            Connect your Shopee store and manage everything from one beautiful dashboard.
                            View your shop info, products, and orders at a glance.
                        </p>
                        <button
                            onClick={async () => {
                                try {
                                    const res = await fetch('/api/auth');
                                    const data = await res.json();
                                    if (data.authLink) {
                                        window.location.href = data.authLink;
                                    }
                                } catch (error) {
                                    console.error('Failed to get auth link:', error);
                                    setMessage({ type: 'error', text: '❌ Failed to connect to Shopee' });
                                }
                            }}
                            className="btn btn-primary"
                            style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}
                        >
                            🔗 Connect Your Shopee Store
                        </button>

                        <div className="features">
                            <div className="feature">
                                <span className="feature-icon">🏪</span>
                                <span>Shop Info</span>
                            </div>
                            <div className="feature">
                                <span className="feature-icon">📦</span>
                                <span>Products</span>
                            </div>
                            <div className="feature">
                                <span className="feature-icon">🛍️</span>
                                <span>Orders</span>
                            </div>
                            <div className="feature">
                                <span className="feature-icon">📊</span>
                                <span>Analytics</span>
                            </div>
                        </div>
                    </section>

                    <footer className="footer">
                        <p>Shopee Seller Hub © 2025 for Shopee sellers.</p>
                    </footer>
                </main>
            ) : (
                <div className="app-layout">
                    <Sidebar isConnected={isConnected} />

                    <main className="main-content">
                        {message && (
                            <div className={`message message-${message.type}`} style={{ marginBottom: '1rem' }}>
                                {message.text}
                            </div>
                        )}

                        {/* Dashboard for authenticated users */}
                        <section className="dashboard">
                            <div className="dashboard-header">
                                <h1>Welcome back! 👋</h1>
                                <p>Here&apos;s what&apos;s happening with your store today.</p>
                            </div>

                            {/* Shop Info Card */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <ShopInfo shop={shop} loading={shopLoading} />
                            </div>

                            {/* Products and Orders Grid */}
                            <div className="grid grid-2">
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
                                <OrderList
                                    orders={orders}
                                    loading={ordersLoading}
                                    hasMore={hasMoreOrders}
                                    currentPage={ordersPage}
                                    onPageChange={handleOrdersPageChange}
                                />
                            </div>
                        </section>

                        <footer className="footer">
                            <p>Shopee Seller Hub © 2025 for Shopee sellers.</p>
                        </footer>
                    </main>
                </div>
            )}
        </>
    );
}
