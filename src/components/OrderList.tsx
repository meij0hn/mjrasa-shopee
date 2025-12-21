'use client';

interface Order {
    order_sn: string;
    order_status: string;
    create_time?: number;
}

interface OrderListProps {
    orders: Order[];
    loading: boolean;
    hasMore?: boolean;
}

export default function OrderList({ orders, loading, hasMore }: OrderListProps) {
    if (loading) {
        return (
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🛍️ Recent Orders</span>
                </div>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <span>Loading orders...</span>
                </div>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { class: string; label: string }> = {
            'UNPAID': { class: 'badge-warning', label: 'Unpaid' },
            'READY_TO_SHIP': { class: 'badge-info', label: 'Ready to Ship' },
            'PROCESSED': { class: 'badge-info', label: 'Processed' },
            'SHIPPED': { class: 'badge-info', label: 'Shipped' },
            'COMPLETED': { class: 'badge-success', label: 'Completed' },
            'IN_CANCEL': { class: 'badge-warning', label: 'Cancelling' },
            'CANCELLED': { class: 'badge-error', label: 'Cancelled' },
            'INVOICE_PENDING': { class: 'badge-warning', label: 'Invoice Pending' },
        };

        const config = statusMap[status] || { class: 'badge-info', label: status };
        return <span className={`badge ${config.class}`}>{config.label}</span>;
    };

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">🛍️ Recent Orders</span>
                <span className="badge badge-info">{orders.length} orders</span>
            </div>

            {orders.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🛍️</div>
                    <p>No orders found</p>
                    <span style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        Orders from the last 15 days will appear here
                    </span>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Status</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.order_sn}>
                                    <td>
                                        <strong>{order.order_sn}</strong>
                                    </td>
                                    <td>{getStatusBadge(order.order_status)}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>
                                        {order.create_time
                                            ? new Date(order.create_time * 1000).toLocaleDateString()
                                            : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {hasMore && (
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                More orders available...
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
