'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
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

    // Fetch data when connected
    const fetchData = useCallback(async () => {
        if (!isConnected) return;

        // Fetch shop info
        setShopLoading(true);
        try {
            const res = await fetch('/api/shop');
            const data = await res.json();
            console.log('Shop API Response:', data);

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

        // Fetch products
        setProductsLoading(true);
        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            if (data.response?.item) {
                setProducts(data.response.item);
                setHasMoreProducts(data.response.has_next_page);
            }
        } catch (error) {
            console.error('Products fetch failed:', error);
        } finally {
            setProductsLoading(false);
        }

        // Fetch orders
        setOrdersLoading(true);
        try {
            const res = await fetch('/api/orders');
            const data = await res.json();
            console.log('Orders API Response:', data);

            if (data.response?.order_list) {
                setOrders(data.response.order_list);
                setHasMoreOrders(data.response.more);
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

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle logout
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/status', { method: 'DELETE' });
            setIsConnected(false);
            setShop(null);
            setProducts([]);
            setOrders([]);
            setMessage({ type: 'success', text: '👋 Logged out successfully' });
        } catch (error) {
            console.error('Logout failed:', error);
        }
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

            <main className="container">
                {message && (
                    <div className={`message message-${message.type}`} style={{ marginTop: '1rem' }}>
                        {message.text}
                    </div>
                )}

                {!isConnected ? (
                    // Hero section for unauthenticated users
                    <section className="hero">
                        <h1>Shopee Seller Hub</h1>
                        <p>
                            Connect your Shopee store and manage everything from one beautiful dashboard.
                            View your shop info, products, and orders at a glance.
                        </p>
                        <a href="/api/auth" className="btn btn-primary" style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}>
                            🔗 Connect Your Shopee Store
                        </a>

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
                ) : (
                    // Dashboard for authenticated users
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
                                onStockUpdate={fetchData}
                            />
                            <OrderList
                                orders={orders}
                                loading={ordersLoading}
                                hasMore={hasMoreOrders}
                            />
                        </div>
                    </section>
                )}

                <footer className="footer">
                    <p>Shopee Seller Hub © 2024. Built with ❤️ for Shopee sellers.</p>
                </footer>
            </main>
        </>
    );
}
