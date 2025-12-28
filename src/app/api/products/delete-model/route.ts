import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getModelList, updateTierVariation } from '@/lib/shopee';

interface ModelData {
    model_id: number;
    model_name?: string;
    model_sku?: string;
    tier_index?: number[];
    stock_info_v2?: {
        summary_info?: {
            total_available_stock?: number;
        };
    };
}

interface TierVariationData {
    name: string;
    option_list: Array<{
        option: string;
        image?: {
            image_id: string;
        };
    }>;
}

// POST endpoint to delete variation options with zero stock
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('shopee_access_token')?.value;
        const shopIdStr = cookieStore.get('shopee_shop_id')?.value;

        if (!accessToken || !shopIdStr) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const shopId = parseInt(shopIdStr, 10);
        const { item_id, options_to_delete } = await request.json();

        if (!item_id || !options_to_delete || !Array.isArray(options_to_delete) || options_to_delete.length === 0) {
            return NextResponse.json({ error: 'item_id and options_to_delete are required' }, { status: 400 });
        }

        // Get current model list to get tier variation info
        const modelListResult = await getModelList(accessToken, shopId, item_id);

        if (modelListResult.error) {
            return NextResponse.json({
                success: false,
                message: modelListResult.message || 'Failed to get model list'
            });
        }

        const tierVariations: TierVariationData[] = modelListResult.response?.tier_variation || [];
        const models: ModelData[] = modelListResult.response?.model || [];

        if (tierVariations.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'This product has no tier variations',
            });
        }

        // Build new tier variation without the options to delete
        // options_to_delete format: [{ tier_index: 0, option_index: 2 }, ...]
        const newTierVariation = tierVariations.map((tier, tierIdx) => {
            const optionsToRemoveInThisTier = options_to_delete
                .filter((opt: { tier_index: number }) => opt.tier_index === tierIdx)
                .map((opt: { option_index: number }) => opt.option_index);

            const newOptionList = tier.option_list.filter((_, optIdx) =>
                !optionsToRemoveInThisTier.includes(optIdx)
            );

            return {
                name: tier.name,
                option_list: newOptionList,
            };
        });

        // Check if any tier would have 0 options left
        for (const tier of newTierVariation) {
            if (tier.option_list.length === 0) {
                return NextResponse.json({
                    success: false,
                    message: 'Cannot delete all options from a tier variation. At least one option must remain.',
                });
            }
        }

        // Filter models to only keep those that don't reference deleted options
        // We need to rebuild model list without the deleted options
        const optionIndexMapping: Map<number, Map<number, number>> = new Map();

        tierVariations.forEach((tier, tierIdx) => {
            const mapping = new Map<number, number>();
            let newIndex = 0;

            tier.option_list.forEach((_, optIdx) => {
                const isDeleted = options_to_delete.some(
                    (opt: { tier_index: number; option_index: number }) =>
                        opt.tier_index === tierIdx && opt.option_index === optIdx
                );

                if (!isDeleted) {
                    mapping.set(optIdx, newIndex);
                    newIndex++;
                }
            });

            optionIndexMapping.set(tierIdx, mapping);
        });

        // Keep models that don't reference any deleted option
        const modelsToKeep = models.filter(model => {
            if (!model.tier_index) return false;

            return model.tier_index.every((optIdx, tierIdx) => {
                const mapping = optionIndexMapping.get(tierIdx);
                return mapping && mapping.has(optIdx);
            });
        });

        // Remap tier_index for remaining models
        const remappedModels = modelsToKeep.map(model => {
            const newTierIndex = model.tier_index!.map((optIdx, tierIdx) => {
                const mapping = optionIndexMapping.get(tierIdx);
                return mapping!.get(optIdx)!;
            });

            return {
                tier_index: newTierIndex,
                model_sku: model.model_sku,
            };
        });

        // Call update_tier_variation API
        const result = await updateTierVariation(
            accessToken,
            shopId,
            item_id,
            newTierVariation,
            remappedModels
        );

        if (result.error) {
            return NextResponse.json({
                success: false,
                message: result.message || 'Failed to update tier variation',
                error: result.error,
            });
        }

        return NextResponse.json({
            success: true,
            message: `Successfully deleted ${options_to_delete.length} variation option(s)`,
            result,
        });
    } catch (error) {
        console.error('Delete variation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET endpoint to get models with zero stock and identify deletable options
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('shopee_access_token')?.value;
        const shopIdStr = cookieStore.get('shopee_shop_id')?.value;

        if (!accessToken || !shopIdStr) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const shopId = parseInt(shopIdStr, 10);
        const { searchParams } = new URL(request.url);
        const itemId = searchParams.get('item_id');

        if (!itemId) {
            return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
        }

        const result = await getModelList(accessToken, shopId, parseInt(itemId, 10));

        if (result.error) {
            return NextResponse.json({ error: result.message || 'Failed to get models' }, { status: 400 });
        }

        const tierVariations: TierVariationData[] = result.response?.tier_variation || [];
        const models: ModelData[] = result.response?.model || [];

        if (tierVariations.length === 0) {
            return NextResponse.json({
                success: true,
                models: [],
                zero_stock_count: 0,
                deletable_options: [],
                message: 'Product has no tier variations',
            });
        }

        // Filter models with zero stock
        const zeroStockModels = models.filter((model) => {
            const availableStock = model.stock_info_v2?.summary_info?.total_available_stock ?? 0;
            return availableStock === 0;
        });

        // Find variation OPTIONS where ALL their models have 0 stock
        // An option can be deleted if ALL models that reference it have 0 stock
        const deletableOptions: Array<{
            tier_index: number;
            option_index: number;
            tier_name: string;
            option_name: string;
            affected_models: number;
        }> = [];

        tierVariations.forEach((tier, tierIdx) => {
            tier.option_list.forEach((option, optIdx) => {
                // Find all models that reference this option
                const modelsForThisOption = models.filter(model =>
                    model.tier_index && model.tier_index[tierIdx] === optIdx
                );

                if (modelsForThisOption.length === 0) return;

                // Check if ALL models for this option have 0 stock
                const allHaveZeroStock = modelsForThisOption.every(model => {
                    const availableStock = model.stock_info_v2?.summary_info?.total_available_stock ?? 0;
                    return availableStock === 0;
                });

                if (allHaveZeroStock) {
                    // Check if this is not the last option in the tier
                    // (cannot delete last option)
                    const otherOptions = tier.option_list.filter((_, idx) => idx !== optIdx);
                    const otherOptionsHaveModels = otherOptions.some((_, otherOptIdx) => {
                        const actualIdx = otherOptIdx >= optIdx ? otherOptIdx + 1 : otherOptIdx;
                        return models.some(m => m.tier_index && m.tier_index[tierIdx] === actualIdx);
                    });

                    // Only mark as deletable if there are other options with models
                    if (tier.option_list.length > 1) {
                        deletableOptions.push({
                            tier_index: tierIdx,
                            option_index: optIdx,
                            tier_name: tier.name,
                            option_name: option.option,
                            affected_models: modelsForThisOption.length,
                        });
                    }
                }
            });
        });

        return NextResponse.json({
            success: true,
            tier_variations: tierVariations,
            models: zeroStockModels,
            total_models: models.length,
            zero_stock_count: zeroStockModels.length,
            deletable_options: deletableOptions,
        });
    } catch (error) {
        console.error('Get zero stock models error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
