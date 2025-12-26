import { NextResponse } from 'next/server';
import { generateAuthLink } from '@/lib/shopee';

export async function GET() {
    const redirectUrl = `${process.env.APP_URL}/auth/callback`;
    const authLink = generateAuthLink(redirectUrl);

    // Return JSON with auth link instead of server-side redirect
    // This avoids CORS issues on Cloudflare Workers
    return NextResponse.json({ authLink });
}
