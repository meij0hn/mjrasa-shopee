import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, refreshAccessToken } from '@/lib/shopee';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { code, shopId, refreshToken, action } = body;

        if (action === 'refresh' && refreshToken && shopId) {
            const result = await refreshAccessToken(refreshToken, shopId);
            return NextResponse.json(result);
        }

        if (code && shopId) {
            const result = await getAccessToken(code, shopId);
            return NextResponse.json(result);
        }

        return NextResponse.json(
            { error: 'Missing required parameters' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Token error:', error);
        return NextResponse.json(
            { error: 'Failed to get token' },
            { status: 500 }
        );
    }
}
