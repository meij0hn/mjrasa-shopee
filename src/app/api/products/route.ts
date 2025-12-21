import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getProductList } from '@/lib/shopee';

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
        const offset = parseInt(searchParams.get('offset') || '0');
        const pageSize = parseInt(searchParams.get('page_size') || '20');

        const result = await getProductList(
            accessToken,
            parseInt(shopId),
            offset,
            pageSize
        );

        return NextResponse.json(result);
    } catch (error) {
        console.error('Products error:', error);
        return NextResponse.json(
            { error: 'Failed to get products' },
            { status: 500 }
        );
    }
}
