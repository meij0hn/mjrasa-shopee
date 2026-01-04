'use client';

import { useState, useEffect, useRef } from 'react';
import Cleave from 'cleave.js/react';
import { CleaveOptions } from 'cleave.js/options';

// Cleave options for stock input
const cleaveOptions: CleaveOptions = {
    numeral: true,
    numeralThousandsGroupStyle: 'thousand' as const,
    numeralDecimalScale: 0,
    numeralDecimalMark: '.',
    delimiter: ',',
};

interface Model {
    model_id: number;
    model_name?: string;
    model_sku?: string;
    current_stock?: number;
    seller_stock?: Array<{ stock: number }>;
    stock_info_v2?: StockInfo;
    tier_index?: number[];
}

interface StockEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: number;
    onSuccess: () => void;
}

interface StockValue {
    model_id: number;
    stock: number;
    stock_info_v2?: StockInfo;
    original_stock: number;
    model_name?: string;
}

interface StockInfo {
    summary_info?: SummaryInfo;
}

interface SummaryInfo {
    total_reserved_stock: number;
    total_available_stock: number;
}

export default function StockEditModal({ isOpen, onClose, itemId, onSuccess }: StockEditModalProps) {
    const [models, setModels] = useState<Model[]>([]);
    const [stockValues, setStockValues] = useState<StockValue[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (isOpen && itemId && !fetchedRef.current) {
            fetchedRef.current = true;
            fetchModels();
        }

        // Reset ref when modal closes
        if (!isOpen) {
            fetchedRef.current = false;
        }
    }, [isOpen, itemId]);

    const fetchModels = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/products/models?item_id=${itemId}`);
            const data = await res.json();
            console.log('Modal - Models response:', data);

            if (data.response?.model && data.response.model.length > 0) {
                // Sort models by tier_index for consistent ordering
                const sortedModels = [...data.response.model].sort((a: Model, b: Model) => {
                    const tierA = a.tier_index || [];
                    const tierB = b.tier_index || [];
                    // Compare each tier level
                    for (let i = 0; i < Math.max(tierA.length, tierB.length); i++) {
                        const valA = tierA[i] ?? 0;
                        const valB = tierB[i] ?? 0;
                        if (valA !== valB) return valA - valB;
                    }
                    return 0;
                });
                setModels(sortedModels);
                // Initialize stock values from models - use total_available_stock as current value
                const values = sortedModels.map((model: Model) => {
                    const currentStock = model.stock_info_v2?.summary_info?.total_available_stock ?? model.seller_stock?.[0]?.stock ?? model.current_stock ?? 0;
                    return {
                        model_id: model.model_id,
                        stock: currentStock,
                        stock_info_v2: model.stock_info_v2,
                        original_stock: currentStock,
                        model_name: model.model_name,
                    };
                });
                console.log('Modal - Stock values:', values);
                console.log('Modal - Model Stock:', values[0]?.stock_info_v2?.summary_info?.total_available_stock);
                setStockValues(values);
            } else {
                // No variants, single model with id 0
                setModels([{ model_id: 0, model_name: 'Default' }]);
                setStockValues([{
                    model_id: 0,
                    stock: 0,
                    stock_info_v2: {
                        summary_info: {
                            total_available_stock: 0,
                            total_reserved_stock: 0,
                        },
                    },
                    original_stock: 0,
                    model_name: 'Default',
                }]);
            }
        } catch (error) {
            console.error('Fetch models error:', error);
            setMessage({ type: 'error', text: 'Failed to load product models' });
        } finally {
            setLoading(false);
        }
    };

    const handleStockChange = (modelId: number, rawValue: string) => {
        const numValue = parseInt(rawValue) || 0;
        setStockValues(prev =>
            prev.map(item =>
                item.model_id === modelId ? { ...item, stock: numValue } : item
            )
        );
    };

    const getChangedItems = () => {
        return stockValues.filter(item => item.stock !== item.original_stock);
    };

    const handleSubmit = async () => {
        const changedItems = getChangedItems();
        if (changedItems.length === 0) {
            setMessage({ type: 'error', text: 'No changes to save' });
            return;
        }

        setUpdating(true);
        setMessage(null);

        try {
            const res = await fetch('/api/products/stock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    item_id: itemId,
                    stock_items: changedItems.map(item => ({
                        model_id: item.model_id,
                        stock: item.stock,
                    })),
                }),
            });

            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: `✅ Updated ${changedItems.length} model(s) successfully!` });
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1000);
            } else {
                setMessage({ type: 'error', text: `❌ ${data.error || data.message || 'Failed to update'}` });
            }
        } catch (error) {
            console.error('Update stock error:', error);
            setMessage({ type: 'error', text: '❌ Network error' });
        } finally {
            setUpdating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>📦 Edit Stock - Item #{itemId}</h3>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                {message && (
                    <div className={`message message-${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="modal-body">
                    {loading ? (
                        <div className="loading-container">
                            <div className="spinner"></div>
                            <span>Loading models...</span>
                        </div>
                    ) : (
                        <div className="stock-list">
                            <div className="stock-list-header">
                                <span>Model</span>
                                <span>Stock</span>
                            </div>
                            {stockValues.map((item) => (
                                <div key={item.model_id} className="stock-item">
                                    <span className="model-name">{item.model_name}</span>
                                    <Cleave
                                        options={cleaveOptions}
                                        value={item.stock.toString()}
                                        onChange={(e) => handleStockChange(item.model_id, e.target.rawValue)}
                                        className="stock-input"
                                        disabled={updating}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <span className="change-count">
                        {getChangedItems().length} change(s)
                    </span>
                    <div className="modal-actions">
                        <button
                            onClick={onClose}
                            className="btn btn-secondary"
                            disabled={updating}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="btn btn-primary"
                            disabled={updating || loading || getChangedItems().length === 0}
                        >
                            {updating ? 'Updating...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                .modal-content {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    width: 90%;
                    max-width: 500px;
                    max-height: 80vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                }
                .modal-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                }
                .modal-close {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 1.25rem;
                    cursor: pointer;
                    padding: 0.25rem;
                }
                .modal-close:hover {
                    color: var(--text-primary);
                }
                .modal-body {
                    padding: 1.5rem;
                    overflow-y: auto;
                    flex: 1;
                }
                .stock-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .stock-list-header {
                    display: grid;
                    grid-template-columns: 1fr 100px;
                    gap: 1rem;
                    padding: 0.5rem 0;
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid var(--border-color);
                }
                .stock-item {
                    display: grid;
                    grid-template-columns: 1fr 100px;
                    gap: 1rem;
                    align-items: center;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid var(--border-color);
                }
                .model-name {
                    font-weight: 500;
                    font-size: 0.9rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .current-stock {
                    color: var(--text-secondary);
                    text-align: center;
                }
                .stock-input {
                    width: 100%;
                    padding: 0.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    text-align: center;
                    font-size: 0.9rem;
                }
                .stock-input:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                }
                .modal-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.5rem;
                    border-top: 1px solid var(--border-color);
                    background: var(--bg-primary);
                }
                .change-count {
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                }
                .modal-actions {
                    display: flex;
                    gap: 0.75rem;
                }
            `}</style>
        </div>
    );
}
