// Test script for Shopee Order Detail API
const crypto = require('crypto');

// Credentials
const PARTNER_ID = '1203240';
const PARTNER_KEY = 'shpk777676574c704c6870496a436166455665746d544153724d4c644972706b';
const API_URL = 'https://openplatform.sandbox.test-stable.shopee.sg';
const SHOP_ID = '226264877';

// You need to get a fresh access_token from browser cookies or terminal log
// Replace this with actual token from your session
const ACCESS_TOKEN = '444e6974626f585674524c70746d594d';

function generateSign(partnerId, path, timestamp, accessToken, shopId) {
    let baseString = `${partnerId}${path}${timestamp}`;
    if (accessToken) baseString += accessToken;
    if (shopId) baseString += shopId;

    return crypto
        .createHmac('sha256', PARTNER_KEY)
        .update(baseString)
        .digest('hex');
}

async function testOrderList() {
    const path = '/api/v2/order/get_order_list';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(PARTNER_ID, path, timestamp, ACCESS_TOKEN, parseInt(SHOP_ID));

    const now = timestamp;
    const fifteenDaysAgo = now - (15 * 24 * 60 * 60);

    const params = new URLSearchParams({
        partner_id: PARTNER_ID,
        timestamp: timestamp.toString(),
        access_token: ACCESS_TOKEN,
        shop_id: SHOP_ID,
        sign: sign,
        time_range_field: 'create_time',
        time_from: fifteenDaysAgo.toString(),
        time_to: now.toString(),
        page_size: '20',
    });

    const url = `${API_URL}${path}?${params.toString()}`;
    console.log('=== ORDER LIST ===');
    console.log('URL:', url);

    const response = await fetch(url);
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));

    return result;
}

async function testOrderDetail(orderSnList) {
    const path = '/api/v2/order/get_order_detail';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(PARTNER_ID, path, timestamp, ACCESS_TOKEN, parseInt(SHOP_ID));

    const params = new URLSearchParams({
        partner_id: PARTNER_ID,
        timestamp: timestamp.toString(),
        access_token: ACCESS_TOKEN,
        shop_id: SHOP_ID,
        sign: sign,
        order_sn_list: orderSnList.join(','),
        response_optional_fields: 'order_status,create_time,update_time,buyer_username,total_amount',
    });

    const url = `${API_URL}${path}?${params.toString()}`;
    console.log('\n=== ORDER DETAIL ===');
    console.log('URL:', url);
    console.log('order_sn_list:', orderSnList.join(','));

    const response = await fetch(url);
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));

    return result;
}

async function main() {
    console.log('Testing Shopee Order APIs...\n');

    // Test Order List
    const orderListResult = await testOrderList();

    // If orders found, test order detail
    const orders = orderListResult.response?.order_list || [];
    if (orders.length > 0) {
        const orderSnList = orders.map(o => o.order_sn);
        await testOrderDetail(orderSnList);
    } else {
        console.log('\nNo orders found to test order detail');
    }
}

main().catch(console.error);
