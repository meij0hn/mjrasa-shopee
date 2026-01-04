import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateModel } from '@/lib/shopee';

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
        const { item_id, model_list } = body;

        if (!item_id || !model_list || !Array.isArray(model_list)) {
            return NextResponse.json(
                { error: 'Missing required parameters: item_id and model_list' },
                { status: 400 }
            );
        }

        const result = await updateModel(
            accessToken,
            parseInt(shopId),
            item_id,
            model_list
        );

        if (result.error) {
            return NextResponse.json(
                { success: false, error: result.message || result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true, response: result.response });
    } catch (error) {
        console.error('Update model error:', error);
        return NextResponse.json(
            { error: 'Failed to update model' },
            { status: 500 }
        );
    }
}
