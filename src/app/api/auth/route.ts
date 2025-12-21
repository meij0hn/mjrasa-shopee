import { NextResponse } from 'next/server';
import { generateAuthLink } from '@/lib/shopee';

export async function GET() {
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
    const authLink = generateAuthLink(redirectUrl);

    return NextResponse.redirect(authLink);
}
