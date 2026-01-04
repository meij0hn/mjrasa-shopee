import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { addModel, getModelList, updateTierVariation } from '@/lib/shopee';

interface TierVariation {
    name: string;
    option_list: { option: string }[];
}

interface ModelData {
    tier_index: number[];
    model_id?: number;
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('shopee_access_token')?.value;
        const shopId = cookieStore.get('shopee_shop_id')?.value;

        if (!accessToken || !shopId) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { item_id, model_name, price, weight, stock = 1 } = body;

        if (!item_id || !model_name || !price) {
            return NextResponse.json(
                { error: 'Missing required parameters: item_id, model_name, price' },
                { status: 400 }
            );
        }

        // Step 1: Get current tier variations and models
        const modelListResult = await getModelList(accessToken, parseInt(shopId), item_id);

        if (modelListResult.error) {
            return NextResponse.json(
                { success: false, error: modelListResult.message || 'Failed to get tier variations' },
                { status: 400 }
            );
        }

        const tierVariations: TierVariation[] = modelListResult.response?.tier_variation || [];
        const existingModels: ModelData[] = modelListResult.response?.model || [];

        // Check if product has tier variations
        if (tierVariations.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Product does not have tier variations' },
                { status: 400 }
            );
        }

        const firstTier = tierVariations[0];

        // Find tier_index for the model_name (case insensitive)
        let tierIndex = firstTier.option_list.findIndex(
            opt => opt.option.toLowerCase() === model_name.toLowerCase()
        );

        // Get all tier indices that already have models
        const usedTierIndices = new Set(
            existingModels.map(m => m.tier_index[0])
        );

        console.log('Tier options:', firstTier.option_list.map(o => o.option));
        console.log('Used tier indices (have models):', Array.from(usedTierIndices));

        if (tierIndex !== -1) {
            // Tier option exists
            if (usedTierIndices.has(tierIndex)) {
                return NextResponse.json(
                    { success: false, error: `Model "${model_name}" sudah ada` },
                    { status: 400 }
                );
            }
            // Tier option exists but no model yet - we can just add_model
            console.log(`Tier option "${model_name}" exists at index ${tierIndex} without model. Adding model...`);
        } else {
            // Need to add new tier option first
            console.log(`Model "${model_name}" not found in tier options. Adding tier option...`);

            // New tier index will be at the end
            tierIndex = firstTier.option_list.length;

            // Create updated tier variation with new option
            const updatedTierVariation = tierVariations.map((tier, idx) => {
                if (idx === 0) {
                    return {
                        name: tier.name,
                        option_list: [
                            ...tier.option_list.map(opt => ({ option: opt.option })),
                            { option: model_name }
                        ]
                    };
                }
                return {
                    name: tier.name,
                    option_list: tier.option_list.map(opt => ({ option: opt.option }))
                };
            });

            // Keep existing models' tier_index
            const existingModelInfo = existingModels.map((m) => ({
                tier_index: m.tier_index
            }));

            console.log('Calling updateTierVariation...');
            console.log('New tier variation:', JSON.stringify(updatedTierVariation, null, 2));
            console.log('Existing models:', JSON.stringify(existingModelInfo, null, 2));

            const updateResult = await updateTierVariation(
                accessToken,
                parseInt(shopId),
                item_id,
                updatedTierVariation,
                existingModelInfo
            );

            if (updateResult.error) {
                return NextResponse.json(
                    { success: false, error: `Failed to add tier option: ${updateResult.message || updateResult.error}` },
                    { status: 400 }
                );
            }

            console.log('Tier option added successfully at index', tierIndex);

            // Wait for Shopee API to process the tier variation update
            // This prevents "Model tier_index error" on first attempt
            console.log('Waiting 1s for Shopee to process tier variation update...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Step 2: Add the model using add_model API with retry logic
        console.log(`Adding model with tier_index [${tierIndex}]...`);

        const modelData = [{
            tier_index: [tierIndex],
            price: price,
            stock: stock,
            weight: weight
        }];

        // Retry logic for addModel (Shopee API sometimes needs time to sync)
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`Add model attempt ${attempt}/${maxRetries}...`);

            const addResult = await addModel(
                accessToken,
                parseInt(shopId),
                item_id,
                modelData
            );

            if (!addResult.error) {
                console.log('Model added successfully');
                return NextResponse.json({
                    success: true,
                    response: addResult.response,
                    tier_index: tierIndex,
                    model_name: model_name
                });
            }

            lastError = addResult.message || addResult.error;
            console.log(`Attempt ${attempt} failed: ${lastError}`);

            // If it's a tier_index error and we have more retries, wait and try again
            if (attempt < maxRetries && lastError?.includes('tier_index')) {
                console.log('Waiting 1s before retry...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // All retries failed
        return NextResponse.json(
            { success: false, error: `Failed to add model: ${lastError}` },
            { status: 400 }
        );
    } catch (error) {
        console.error('Add model error:', error);
        return NextResponse.json(
            { error: 'Failed to add model' },
            { status: 500 }
        );
    }
}
