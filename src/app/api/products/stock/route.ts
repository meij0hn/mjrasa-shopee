import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateStock } from '@/lib/shopee';

interface StockItem {
    model_id: number;
    stock: number;
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
        const { item_id, stock_items } = body;

        if (!item_id) {
            return NextResponse.json(
                { error: 'Missing required field: item_id' },
                { status: 400 }
            );
        }

        if (!stock_items || !Array.isArray(stock_items) || stock_items.length === 0) {
            return NextResponse.json(
                { error: 'Missing or invalid stock_items array' },
                { status: 400 }
            );
        }

        // Validate all stock items
        for (const item of stock_items as StockItem[]) {
            if (item.model_id === undefined || item.stock === undefined) {
                return NextResponse.json(
                    { error: 'Each stock item must have model_id and stock' },
                    { status: 400 }
                );
            }
            if (item.stock < 0) {
                return NextResponse.json(
                    { error: 'Stock cannot be negative' },
                    { status: 400 }
                );
            }
        }

        const result = await updateStock(
            accessToken,
            parseInt(shopId),
            item_id,
            stock_items
        );

        // Check for Shopee API errors
        if (result.error) {
            return NextResponse.json(
                { error: result.error, message: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Successfully updated stock for ${stock_items.length} model(s)`,
            result,
        });
    } catch (error) {
        console.error('Update stock error:', error);
        return NextResponse.json(
            { error: 'Failed to update stock' },
            { status: 500 }
        );
    }
}
