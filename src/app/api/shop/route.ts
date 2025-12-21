import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getShopInfo } from '@/lib/shopee';

export async function GET() {
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

        const result = await getShopInfo(accessToken, parseInt(shopId));
        console.log('Shop API Response:', JSON.stringify(result, null, 2));
        return NextResponse.json(result);
    } catch (error) {
        console.error('Shop info error:', error);
        return NextResponse.json(
            { error: 'Failed to get shop info' },
            { status: 500 }
        );
    }
}
