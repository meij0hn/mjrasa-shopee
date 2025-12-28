'use client';

import { useState } from 'react';
import StockEditModal from './StockEditModal';
import Pagination from './Pagination';

interface Product {
    item_id: number;
    item_status: string;
    update_time?: number;
}

interface ProductListProps {
    products: Product[];
    loading: boolean;
    hasMore?: boolean;
    currentPage: number;
    totalItems?: number;
    pageSize?: number;
    onPageChange: (page: number) => void;
    onStockUpdate?: () => void;
}

export default function ProductList({
    products,
    loading,
    hasMore,
    currentPage,
    totalItems,
    pageSize = 20,
    onPageChange,
    onStockUpdate
}: ProductListProps) {
    const [editingItemId, setEditingItemId] = useState<number | null>(null);

    const handleEditClick = (product: Product) => {
        setEditingItemId(product.item_id);
    };

    const handleCloseModal = () => {
        setEditingItemId(null);
    };

    const handleStockUpdated = () => {
        if (onStockUpdate) {
            onStockUpdate();
        }
    };

    if (loading) {
        return (
            <div className="card">
                <div className="card-header">
                    <span className="card-title">📦 Products</span>
                </div>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <span>Loading products...</span>
                </div>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'NORMAL':
                return <span className="badge badge-success">Active</span>;
            case 'BANNED':
                return <span className="badge badge-error">Banned</span>;
            case 'UNLIST':
                return <span className="badge badge-warning">Unlisted</span>;
            default:
                return <span className="badge badge-info">{status}</span>;
        }
    };

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <span className="card-title">📦 Products</span>
                    <span className="badge badge-info">
                        {totalItems !== undefined ? `${totalItems} total` : `${products.length} items`}
                    </span>
                </div>

                {products.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📦</div>
                        <p>No products found</p>
                        <span style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                            Products from your Shopee store will appear here
                        </span>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Item ID</th>
                                    <th>Status</th>
                                    <th>Last Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product) => (
                                    <tr key={product.item_id}>
                                        <td>
                                            <strong>#{product.item_id}</strong>
                                        </td>
                                        <td>{getStatusBadge(product.item_status)}</td>
                                        <td style={{ color: 'var(--text-secondary)' }}>
                                            {product.update_time
                                                ? new Date(product.update_time * 1000).toLocaleDateString()
                                                : '-'}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => handleEditClick(product)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                            >
                                                📝 Edit Stock
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <Pagination
                            currentPage={currentPage}
                            hasNextPage={hasMore}
                            hasPrevPage={currentPage > 1}
                            onPageChange={onPageChange}
                            totalItems={totalItems}
                            pageSize={pageSize}
                            loading={loading}
                        />
                    </div>
                )}
            </div>

            {/* Stock Edit Modal */}
            {editingItemId !== null && (
                <StockEditModal
                    isOpen={editingItemId !== null}
                    onClose={handleCloseModal}
                    itemId={editingItemId}
                    onSuccess={handleStockUpdated}
                />
            )}
        </>
    );
}
