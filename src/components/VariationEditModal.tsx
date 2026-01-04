'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Save, X } from 'lucide-react';
import Cleave from 'cleave.js/react';
import { CleaveOptions } from 'cleave.js/options';

// Helper function for formatting display (for non-input elements)
const formatNumber = (num: number): string => {
    if (!num && num !== 0) return '';
    return num.toLocaleString('en-US');
};

// Cleave options for numeral input
const cleaveOptions: CleaveOptions = {
    numeral: true,
    numeralThousandsGroupStyle: 'thousand' as const,
    numeralDecimalScale: 0,
    numeralDecimalMark: '.',
    delimiter: ',',
};

interface PriceInfo {
    original_price?: number;
    current_price?: number;
}

interface Model {
    model_id: number;
    model_name?: string;
    model_sku?: string;
    price_info?: PriceInfo[];
    tier_index?: number[];
    weight?: string | number;
}

interface TierVariation {
    name: string;
    option_list: { option: string }[];
}

interface VariationEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: number;
    onSuccess: () => void;
}

interface EditableModel {
    model_id: number;
    model_name: string;
    original_price: number;
    weight: number;
    tier_index: number[];
    original_price_value: number;
    original_weight_value: number;
}

interface NewVariation {
    model_name: string;
    price: number;
    weight: number;
}

export default function VariationEditModal({ isOpen, onClose, itemId, onSuccess }: VariationEditModalProps) {
    const [models, setModels] = useState<EditableModel[]>([]);
    const [tierVariations, setTierVariations] = useState<TierVariation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fetchedRef = useRef(false);

    // New variation form state
    const [showAddRow, setShowAddRow] = useState(false);
    const [newVariation, setNewVariation] = useState<NewVariation>({
        model_name: '',
        price: 0,
        weight: 0,
    });
    const [newTierSelections, setNewTierSelections] = useState<number[]>([]);
    // Pending new variations (not yet saved to API)
    const [pendingVariations, setPendingVariations] = useState<NewVariation[]>([]);

    useEffect(() => {
        if (isOpen && itemId && !fetchedRef.current) {
            fetchedRef.current = true;
            fetchModels();
        }

        if (!isOpen) {
            fetchedRef.current = false;
            setShowAddRow(false);
            setNewVariation({ model_name: '', price: 0, weight: 0 });
            setNewTierSelections([]);
            setPendingVariations([]);
        }
    }, [isOpen, itemId]);

    const fetchModels = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/products/models?item_id=${itemId}`);
            const data = await res.json();
            console.log('Variation Modal - Models response:', data);

            if (data.response?.tier_variation) {
                setTierVariations(data.response.tier_variation);
                // Initialize tier selections based on tier count
                setNewTierSelections(new Array(data.response.tier_variation.length).fill(0));
            }

            if (data.response?.model && data.response.model.length > 0) {
                const sortedModels = [...data.response.model].sort((a: Model, b: Model) => {
                    const tierA = a.tier_index || [];
                    const tierB = b.tier_index || [];
                    for (let i = 0; i < Math.max(tierA.length, tierB.length); i++) {
                        const valA = tierA[i] ?? 0;
                        const valB = tierB[i] ?? 0;
                        if (valA !== valB) return valA - valB;
                    }
                    return 0;
                });

                const editableModels = sortedModels.map((model: Model) => {
                    // price_info is an array, get first element
                    const price = model.price_info?.[0]?.original_price ?? 0;
                    // weight from API is string or number, convert to grams
                    const weightKg = typeof model.weight === 'string'
                        ? parseFloat(model.weight)
                        : (model.weight ?? 0);
                    const weightGram = Math.round(weightKg * 1000); // Convert kg to gram

                    return {
                        model_id: model.model_id,
                        model_name: model.model_name || 'Default',
                        original_price: price,
                        weight: weightGram,
                        tier_index: model.tier_index || [],
                        original_price_value: price,
                        original_weight_value: weightGram,
                    };
                });

                setModels(editableModels);
            }
        } catch (error) {
            console.error('Fetch models error:', error);
            setMessage({ type: 'error', text: 'Failed to load product models' });
        } finally {
            setLoading(false);
        }
    };

    const handlePriceChange = (modelId: number, rawValue: string) => {
        const numValue = parseFloat(rawValue) || 0;
        setModels(prev =>
            prev.map(item =>
                item.model_id === modelId ? { ...item, original_price: numValue } : item
            )
        );
    };

    const handleWeightChange = (modelId: number, rawValue: string) => {
        const numValue = parseFloat(rawValue) || 0;
        setModels(prev =>
            prev.map(item =>
                item.model_id === modelId ? { ...item, weight: numValue } : item
            )
        );
    };

    const getChangedModels = () => {
        return models.filter(item =>
            item.original_price !== item.original_price_value ||
            item.weight !== item.original_weight_value
        );
    };

    const handleSaveChanges = async () => {
        const changedModels = getChangedModels();
        const hasPendingVariations = pendingVariations.length > 0;

        if (changedModels.length === 0 && !hasPendingVariations) {
            setMessage({ type: 'error', text: 'No changes to save' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            let updateSuccess = true;
            let addSuccess = true;
            let updateCount = 0;
            let addCount = 0;

            // Update existing models if there are changes
            if (changedModels.length > 0) {
                const res = await fetch('/api/products/update-model', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        item_id: itemId,
                        model_list: changedModels.map(item => ({
                            model_id: item.model_id,
                            original_price: item.original_price,
                            weight: item.weight ? item.weight / 1000 : undefined,
                        })),
                    }),
                });

                const data = await res.json();
                if (data.success) {
                    updateCount = changedModels.length;
                    setModels(prev => prev.map(item => ({
                        ...item,
                        original_price_value: item.original_price,
                        original_weight_value: item.weight,
                    })));
                } else {
                    updateSuccess = false;
                    setMessage({ type: 'error', text: `❌ ${data.error || 'Failed to update models'}` });
                }
            }

            // Add new variations if there are pending ones
            if (hasPendingVariations && updateSuccess) {
                for (const variation of pendingVariations) {
                    const res = await fetch('/api/products/add-model', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            item_id: itemId,
                            model_name: variation.model_name.trim(),
                            price: variation.price,
                            stock: 1,
                            weight: variation.weight ? variation.weight / 1000 : undefined,
                        }),
                    });

                    const data = await res.json();
                    if (data.success) {
                        addCount++;
                    } else {
                        addSuccess = false;
                        setMessage({ type: 'error', text: `❌ Gagal menambah variasi: ${variation.model_name}` });
                        break;
                    }
                }
            }

            if (updateSuccess && addSuccess) {
                const messages = [];
                if (updateCount > 0) messages.push(`${updateCount} model diupdate`);
                if (addCount > 0) messages.push(`${addCount} variasi ditambahkan`);
                setMessage({ type: 'success', text: `✅ ${messages.join(', ')}!` });

                // Clear pending variations and refresh
                setPendingVariations([]);
                fetchedRef.current = false;
                fetchModels();
                onSuccess();
            }
        } catch (error) {
            console.error('Save changes error:', error);
            setMessage({ type: 'error', text: '❌ Network error' });
        } finally {
            setSaving(false);
        }
    };

    const handleAddVariation = () => {
        if (!newVariation.model_name.trim()) {
            setMessage({ type: 'error', text: 'Nama model harus diisi' });
            return;
        }
        if (newVariation.price <= 0) {
            setMessage({ type: 'error', text: 'Harga harus lebih dari 0' });
            return;
        }

        // Add to pending list (don't hit API yet)
        setPendingVariations(prev => [...prev, { ...newVariation }]);
        setShowAddRow(false);
        setNewVariation({ model_name: '', price: 0, weight: 0 });
        setMessage({ type: 'success', text: '✅ Variasi ditambahkan ke daftar (belum disimpan)' });
    };

    const handleRemovePending = (index: number) => {
        setPendingVariations(prev => prev.filter((_, i) => i !== index));
    };

    const getTotalChanges = () => {
        return getChangedModels().length + pendingVariations.length;
    };

    const handleTierSelection = (tierIndex: number, optionIndex: number) => {
        setNewTierSelections(prev => {
            const updated = [...prev];
            updated[tierIndex] = optionIndex;
            return updated;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content variation-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>⚙️ Edit Variasi - Item #{itemId}</h3>
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
                            <span>Loading variations...</span>
                        </div>
                    ) : (
                        <>
                            {/* Existing Models List */}
                            <div className="variation-list">
                                <div className="variation-list-header">
                                    <span>Model</span>
                                    <span>Harga</span>
                                    <span>Berat (g)</span>
                                    <span></span>
                                </div>
                                {models.map((item) => (
                                    <div key={item.model_id} className="variation-item">
                                        <span className="model-name">{item.model_name}</span>
                                        <Cleave
                                            options={cleaveOptions}
                                            value={item.original_price.toString()}
                                            onChange={(e) => handlePriceChange(item.model_id, e.target.rawValue)}
                                            className="variation-input"
                                            disabled={saving}
                                        />
                                        <Cleave
                                            options={cleaveOptions}
                                            value={item.weight.toString()}
                                            onChange={(e) => handleWeightChange(item.model_id, e.target.rawValue)}
                                            className="variation-input"
                                            disabled={saving}
                                        />
                                        <span></span>
                                    </div>
                                ))}

                                {/* Pending new variations (not yet saved) */}
                                {pendingVariations.map((item, index) => (
                                    <div key={`pending-${index}`} className="variation-item pending-row">
                                        <span className="model-name pending-label">
                                            {item.model_name}
                                            <span className="pending-badge">Baru</span>
                                        </span>
                                        <span className="pending-value">{formatNumber(item.price)}</span>
                                        <span className="pending-value">{formatNumber(item.weight || 0)}</span>
                                        <div className="row-actions">
                                            <button
                                                onClick={() => handleRemovePending(index)}
                                                className="btn-icon btn-cancel"
                                                disabled={saving}
                                                title="Hapus"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Inline Add Row */}
                                {showAddRow ? (
                                    <div className="variation-item add-row">
                                        <input
                                            type="text"
                                            value={newVariation.model_name}
                                            onChange={(e) => setNewVariation(prev => ({ ...prev, model_name: e.target.value }))}
                                            className="variation-input"
                                            style={{ textAlign: 'left' }}
                                            placeholder="Nama model"
                                            disabled={saving}
                                        />
                                        <Cleave
                                            options={cleaveOptions}
                                            value={newVariation.price ? newVariation.price.toString() : ''}
                                            onChange={(e) => setNewVariation(prev => ({ ...prev, price: parseFloat(e.target.rawValue) || 0 }))}
                                            className="variation-input"
                                            placeholder="Harga"
                                            disabled={saving}
                                        />
                                        <Cleave
                                            options={cleaveOptions}
                                            value={newVariation.weight ? newVariation.weight.toString() : ''}
                                            onChange={(e) => setNewVariation(prev => ({ ...prev, weight: parseFloat(e.target.rawValue) || 0 }))}
                                            className="variation-input"
                                            placeholder="Berat (g)"
                                            disabled={saving}
                                        />
                                        <div className="row-actions">
                                            <button
                                                onClick={handleAddVariation}
                                                className="btn-icon btn-success"
                                                disabled={saving || newVariation.price <= 0}
                                                title="Tambah"
                                            >
                                                <Plus size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowAddRow(false);
                                                    setNewVariation({ model_name: '', price: 0, weight: 0 });
                                                }}
                                                className="btn-icon btn-cancel"
                                                disabled={saving}
                                                title="Batal"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowAddRow(true)}
                                        className="add-row-btn"
                                        disabled={saving}
                                    >
                                        <Plus size={16} /> Tambah Variasi
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <span className="change-count">
                        {getTotalChanges()} perubahan
                        {pendingVariations.length > 0 && (
                            <span className="pending-count"> ({pendingVariations.length} variasi baru)</span>
                        )}
                    </span>
                    <div className="modal-actions">
                        <button
                            onClick={onClose}
                            className="btn btn-secondary"
                            disabled={saving}
                        >
                            Tutup
                        </button>
                        <button
                            onClick={handleSaveChanges}
                            className="btn btn-primary"
                            disabled={saving || loading || getTotalChanges() === 0}
                        >
                            {saving ? 'Menyimpan...' : <><Save size={16} /> Simpan</>}
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
                .modal-content.variation-modal {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 85vh;
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
                .variation-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .variation-list-header {
                    display: grid;
                    grid-template-columns: 1fr 120px 100px 70px;
                    gap: 0.75rem;
                    padding: 0.5rem 0;
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid var(--border-color);
                }
                .variation-item {
                    display: grid;
                    grid-template-columns: 1fr 120px 100px 70px;
                    gap: 0.75rem;
                    align-items: center;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid var(--border-color);
                }
                .variation-item.pending-row {
                    background: rgba(46, 204, 113, 0.08);
                    border-radius: 8px;
                    padding: 0.75rem !important;
                    margin: 0.25rem 0;
                }
                .model-name {
                    font-weight: 500;
                    font-size: 0.9rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .model-name.pending-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .pending-badge {
                    font-size: 0.65rem;
                    background: #2ecc71;
                    color: white;
                    padding: 0.15rem 0.4rem;
                    border-radius: 4px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .pending-value {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    text-align: right;
                }
                .pending-count {
                    color: #2ecc71;
                    font-weight: 500;
                }
                .variation-input {
                    width: 100%;
                    padding: 0.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    text-align: right;
                    font-size: 0.85rem;
                }
                .variation-input:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                }
                .add-row-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    margin-top: 0.5rem;
                    background: transparent;
                    border: 2px dashed var(--border-color);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .add-row-btn:hover {
                    border-color: var(--accent-primary);
                    color: var(--accent-primary);
                    background: rgba(var(--accent-primary-rgb), 0.05);
                }
                .add-row {
                    background: rgba(var(--accent-primary-rgb), 0.03);
                    border-radius: 8px;
                    padding: 0.75rem !important;
                    margin-top: 0.5rem;
                }
                .add-row input,
                .add-row .variation-input {
                    background: #ffffff !important;
                    border: 1px solid #e0e0e0 !important;
                    border-radius: 4px !important;
                    height: 39px !important;
                    box-sizing: border-box !important;
                }
                .row-actions {
                    display: flex;
                    gap: 0.25rem;
                }
                .btn-icon {
                    padding: 0.4rem;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .btn-icon:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .btn-success {
                    background: #2ecc71;
                    color: white;
                }
                .btn-success:hover:not(:disabled) {
                    background: #27ae60;
                }
                .btn-cancel {
                    background: var(--bg-primary);
                    color: var(--text-secondary);
                    border: 1px solid var(--border-color);
                }
                .btn-cancel:hover:not(:disabled) {
                    background: var(--border-color);
                    color: var(--text-primary);
                }
                .add-form {
                    background: var(--bg-primary);
                    padding: 1.25rem;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                }
                .add-form h4 {
                    margin: 0 0 1rem 0;
                    font-size: 1rem;
                }
                .form-group {
                    margin-bottom: 1rem;
                }
                .form-group label {
                    display: block;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                }
                .form-select,
                .form-input {
                    width: 100%;
                    padding: 0.75rem;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    font-size: 0.9rem;
                }
                .form-select:focus,
                .form-input:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                .tier-selections {
                    display: flex;
                    gap: 0.5rem;
                }
                .tier-selections .form-select {
                    flex: 1;
                }
                .note {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin: 0.5rem 0 1rem 0;
                    font-style: italic;
                }
                .form-actions {
                    display: flex;
                    gap: 0.75rem;
                    justify-content: flex-end;
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
                .message {
                    padding: 0.75rem 1.5rem;
                    font-size: 0.9rem;
                }
                .message-success {
                    background: rgba(46, 204, 113, 0.1);
                    color: #2ecc71;
                }
                .message-error {
                    background: rgba(231, 76, 60, 0.1);
                    color: #e74c3c;
                }
            `}</style>
        </div>
    );
}
