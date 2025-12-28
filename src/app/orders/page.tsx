'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import OrderList from '@/components/OrderList';

interface Order {
    order_sn: string;
    order_status: string;
    create_time?: number;
}

const PAGE_SIZE = 10;

export default function OrdersPage() {
    const router = useRouter();
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [ordersLoading, setOrdersLoading] = useState(false);

    const [orders, setOrders] = useState<Order[]>([]);
    const [hasMoreOrders, setHasMoreOrders] = useState(false);
    const [ordersPage, setOrdersPage] = useState(1);
    const [ordersCursor, setOrdersCursor] = useState<string | undefined>(undefined);
    const [ordersCursorHistory, setOrdersCursorHistory] = useState<string[]>([]);

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
                if (data.response.next_cursor) {
                    setOrdersCursor(data.response.next_cursor);
                }
            } else if (data.order_list) {
                setOrders(data.order_list);
                setHasMoreOrders(data.more);
            }
        } catch (error) {
            console.error('Orders fetch failed:', error);
            setMessage({ type: 'error', text: '❌ Failed to load orders' });
        } finally {
            setOrdersLoading(false);
        }
    }, [isConnected]);

    // Initial data fetch
    useEffect(() => {
        if (isConnected) {
            fetchOrders(1);
        }
    }, [isConnected, fetchOrders]);

    // Handle orders page change
    const handleOrdersPageChange = (page: number) => {
        if (page > ordersPage) {
            if (ordersCursor) {
                setOrdersCursorHistory(prev => [...prev, ordersCursor]);
            }
            setOrdersPage(page);
            fetchOrders(page, ordersCursor);
        } else if (page < ordersPage) {
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
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
        }
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
                            <h1>🛍️ Orders</h1>
                            <p>View and manage your Shopee orders.</p>
                        </div>

                        <OrderList
                            orders={orders}
                            loading={ordersLoading}
                            hasMore={hasMoreOrders}
                            currentPage={ordersPage}
                            onPageChange={handleOrdersPageChange}
                        />
                    </section>

                    <footer className="footer">
                        <p>Shopee Seller Hub © 2024. Built with ❤️ for Shopee sellers.</p>
                    </footer>
                </main>
            </div>
        </>
    );
}
