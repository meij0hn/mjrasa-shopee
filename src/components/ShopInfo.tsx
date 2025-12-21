'use client';

interface ShopInfoProps {
    shop: {
        shop_name?: string;
        region?: string;
        status?: string;
        is_cb?: boolean;
    } | null;
    loading: boolean;
}

export default function ShopInfo({ shop, loading }: ShopInfoProps) {
    if (loading) {
        return (
            <div className="card">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <span>Loading shop info...</span>
                </div>
            </div>
        );
    }

    if (!shop) {
        return (
            <div className="card">
                <div className="empty-state">
                    <div className="empty-state-icon">🏪</div>
                    <p>No shop information available</p>
                </div>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'NORMAL':
                return <span className="badge badge-success">Active</span>;
            case 'FROZEN':
                return <span className="badge badge-warning">Frozen</span>;
            case 'BANNED':
                return <span className="badge badge-error">Banned</span>;
            default:
                return <span className="badge badge-info">{status}</span>;
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">🏪 Shop Information</span>
                {shop.status && getStatusBadge(shop.status)}
            </div>

            <div className="shop-info">
                <div className="shop-avatar">
                    {shop.shop_name?.charAt(0).toUpperCase() || 'S'}
                </div>
                <div className="shop-details">
                    <h3>{shop.shop_name || 'Unknown Shop'}</h3>
                    <div className="shop-meta">
                        <span>📍 {shop.region || 'Unknown Region'}</span>
                        {shop.is_cb && <span>🌐 Cross-border</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
