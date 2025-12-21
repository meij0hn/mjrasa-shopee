import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('shopee_access_token')?.value;
        const shopId = cookieStore.get('shopee_shop_id')?.value;

        return NextResponse.json({
            isConnected: !!(accessToken && shopId),
            shopId: shopId || null,
        });
    } catch {
        return NextResponse.json({
            isConnected: false,
            shopId: null,
        });
    }
}

export async function DELETE() {
    try {
        const cookieStore = await cookies();

        cookieStore.delete('shopee_access_token');
        cookieStore.delete('shopee_refresh_token');
        cookieStore.delete('shopee_shop_id');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Failed to logout' },
            { status: 500 }
        );
    }
}
