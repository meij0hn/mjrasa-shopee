import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getModelList } from '@/lib/shopee';

export async function GET(request: NextRequest) {
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

        const searchParams = request.nextUrl.searchParams;
        const itemId = searchParams.get('item_id');

        if (!itemId) {
            return NextResponse.json(
                { error: 'Missing required parameter: item_id' },
                { status: 400 }
            );
        }

        const result = await getModelList(
            accessToken,
            parseInt(shopId),
            parseInt(itemId)
        );

        // console.log('getModelList Response:', JSON.stringify(result, null, 2));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Get model list error:', error);
        return NextResponse.json(
            { error: 'Failed to get model list' },
            { status: 500 }
        );
    }
}
