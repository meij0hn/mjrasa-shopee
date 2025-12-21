import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOrderList, getOrderDetail } from '@/lib/shopee';

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
        const pageSize = parseInt(searchParams.get('page_size') || '20');

        // Step 1: Get orders from last 15 days
        const now = Math.floor(Date.now() / 1000);
        const fifteenDaysAgo = now - (15 * 24 * 60 * 60);

        const orderListResult = await getOrderList(
            accessToken,
            parseInt(shopId),
            fifteenDaysAgo,
            now,
            pageSize
        );

        // Check if we have orders
        const orders = orderListResult.response?.order_list || orderListResult.order_list || [];

        if (orders.length === 0) {
            return NextResponse.json(orderListResult);
        }

        // Step 2: Try to get order details
        const orderSnList = orders.map((order: { order_sn: string }) => order.order_sn);

        const orderDetailResult = await getOrderDetail(
            accessToken,
            parseInt(shopId),
            orderSnList
        );

        // Check if order details returned data
        const detailedOrders = orderDetailResult.response?.order_list || orderDetailResult.order_list || [];

        // If order detail is empty (sandbox limitation), fallback to order list with enhanced data
        if (detailedOrders.length === 0) {
            // Enhance order list data with placeholder status for display
            const enhancedOrders = orders.map((order: { order_sn: string; booking_sn?: string }) => ({
                order_sn: order.order_sn,
                order_status: null, // Default status for sandbox
                create_time: null, // Current time as fallback
                booking_sn: order.booking_sn || '',
                is_sandbox: true, // Flag to indicate sandbox limitation
            }));

            return NextResponse.json({
                response: {
                    order_list: enhancedOrders,
                    more: orderListResult.response?.more || orderListResult.more || false,
                },
                sandbox_notice: 'Order details not fully available in sandbox environment',
            });
        }

        // Return actual order details if available
        return NextResponse.json({
            response: {
                order_list: detailedOrders,
                more: orderListResult.response?.more || orderListResult.more || false,
            },
        });
    } catch (error) {
        console.error('Orders error:', error);
        return NextResponse.json(
            { error: 'Failed to get orders' },
            { status: 500 }
        );
    }
}
