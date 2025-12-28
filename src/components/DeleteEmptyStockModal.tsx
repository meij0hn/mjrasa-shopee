'use client';

import { useState, useEffect, useRef } from 'react';

interface DeletableOption {
    tier_index: number;
    option_index: number;
    tier_name: string;
    option_name: string;
    affected_models: number;
}

interface DeleteEmptyStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: number;
    onSuccess: () => void;
}

// Simple toast component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'warning'; onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast toast-${type}`}>
            {message}
            <style jsx>{`
                .toast {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 1rem 1.5rem;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    z-index: 2000;
                    animation: slideIn 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                .toast-success {
                    background: #22c55e;
                    color: white;
                }
                .toast-error {
                    background: #ef4444;
                    color: white;
                }
                .toast-warning {
                    background: #f59e0b;
                    color: white;
                }
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}

export default function DeleteEmptyStockModal({ isOpen, onClose, itemId, onSuccess }: DeleteEmptyStockModalProps) {
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
    const [deletableOptions, setDeletableOptions] = useState<DeletableOption[]>([]);
    const [noVariationsMessage, setNoVariationsMessage] = useState<string | null>(null);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (isOpen && itemId && !fetchedRef.current) {
            fetchedRef.current = true;
            fetchDeletableOptions();
        }

        if (!isOpen) {
            fetchedRef.current = false;
            setNoVariationsMessage(null);
        }
    }, [isOpen, itemId]);

    const showToast = (type: 'success' | 'error' | 'warning', text: string) => {
        setToast({ type, text });
    };

    const fetchDeletableOptions = async () => {
        setLoading(true);
        setNoVariationsMessage(null);
        try {
            const res = await fetch(`/api/products/delete-model?item_id=${itemId}`);
            const data = await res.json();
            console.log('Deletable options response:', data);

            if (data.success) {
                setDeletableOptions(data.deletable_options || []);
                if (data.deletable_options?.length === 0) {
                    if (data.zero_stock_count === 0) {
                        setNoVariationsMessage('Tidak ada model dengan stock 0');
                    } else {
                        setNoVariationsMessage(`Ada ${data.zero_stock_count} model dengan stock 0, tapi tidak bisa dihapus karena masih ada model lain dalam variasi yang sama yang memiliki stock.`);
                    }
                }
            } else {
                showToast('error', data.error || data.message || 'Gagal memuat data');
            }
        } catch (error) {
            console.error('Fetch deletable options error:', error);
            showToast('error', 'Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (deletableOptions.length === 0) return;

        setDeleting(true);

        try {
            const optionsToDelete = deletableOptions.map(opt => ({
                tier_index: opt.tier_index,
                option_index: opt.option_index,
            }));

            const res = await fetch('/api/products/delete-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: itemId, options_to_delete: optionsToDelete }),
            });

            const data = await res.json();

            if (data.success) {
                showToast('success', data.message);
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1000);
            } else {
                showToast('error', data.message || 'Gagal menghapus variasi');
            }
        } catch (error) {
            console.error('Delete variation error:', error);
            showToast('error', 'Network error');
        } finally {
            setDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>🗑️ Hapus Variasi Stock 0</h3>
                        <button onClick={onClose} className="modal-close">✕</button>
                    </div>

                    <div className="modal-body">
                        {loading ? (
                            <div className="loading-container">
                                <div className="spinner"></div>
                                <span>Menganalisis variasi...</span>
                            </div>
                        ) : deletableOptions.length === 0 ? (
                            <div className="empty-state-small">
                                <p>{noVariationsMessage || 'Tidak ada variasi yang bisa dihapus.'}</p>
                            </div>
                        ) : (
                            <>
                                <p className="warning-banner">
                                    ⚠️ Variasi berikut akan dihapus permanen:
                                </p>
                                <table className="variation-table">
                                    <thead>
                                        <tr>
                                            <th>Tier</th>
                                            <th>Variasi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deletableOptions.map((opt, idx) => (
                                            <tr key={idx}>
                                                <td>{opt.tier_name}</td>
                                                <td><strong>{opt.option_name}</strong></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button
                            onClick={onClose}
                            className="btn btn-secondary"
                            disabled={deleting}
                        >
                            Batal
                        </button>
                        {deletableOptions.length > 0 && (
                            <button
                                onClick={handleDelete}
                                className="btn btn-danger"
                                disabled={loading || deleting}
                            >
                                {deleting ? 'Menghapus...' : `🗑️ Hapus ${deletableOptions.length} Variasi`}
                            </button>
                        )}
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
                        max-width: 400px;
                        max-height: 80vh;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 1rem 1.25rem;
                        border-bottom: 1px solid var(--border-color);
                    }
                    .modal-header h3 {
                        margin: 0;
                        font-size: 1rem;
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
                        padding: 1.25rem;
                        overflow-y: auto;
                        flex: 1;
                    }
                    .warning-banner {
                        color: #f59e0b;
                        font-size: 0.9rem;
                        margin: 0 0 1rem 0;
                        padding: 0.75rem;
                        background: rgba(245, 158, 11, 0.1);
                        border-radius: 8px;
                        text-align: center;
                    }
                    .variation-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .variation-table th,
                    .variation-table td {
                        padding: 0.75rem;
                        text-align: left;
                        border-bottom: 1px solid var(--border-color);
                    }
                    .variation-table th {
                        font-size: 0.75rem;
                        text-transform: uppercase;
                        color: var(--text-secondary);
                        font-weight: 500;
                    }
                    .variation-table td {
                        font-size: 0.9rem;
                    }
                    .modal-footer {
                        display: flex;
                        justify-content: flex-end;
                        gap: 0.75rem;
                        padding: 1rem 1.25rem;
                        border-top: 1px solid var(--border-color);
                        background: var(--bg-primary);
                    }
                    .btn-danger {
                        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                        color: white;
                        border: none;
                    }
                    .btn-danger:hover {
                        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                    }
                    .btn-danger:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    .empty-state-small {
                        text-align: center;
                        padding: 1.5rem;
                        color: var(--text-secondary);
                    }
                `}</style>
            </div>

            {/* Toast notification */}
            {toast && (
                <Toast
                    message={toast.text}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
}
