import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAccessToken } from '@/lib/shopee';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const shopId = searchParams.get('shop_id');

    if (!code || !shopId) {
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}?error=missing_params`
        );
    }

    try {
        // Exchange code for access token
        const tokenResult = await getAccessToken(code, parseInt(shopId));

        if (tokenResult.error) {
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}?error=${tokenResult.error}`
            );
        }

        // Store tokens in cookies (httpOnly for security)
        const cookieStore = await cookies();

        cookieStore.set('shopee_access_token', tokenResult.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 4, // 4 hours
        });

        cookieStore.set('shopee_refresh_token', tokenResult.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        cookieStore.set('shopee_shop_id', shopId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        // Redirect back to dashboard
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}?connected=true`
        );
    } catch (error) {
        console.error('Callback error:', error);
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}?error=token_exchange_failed`
        );
    }
}
