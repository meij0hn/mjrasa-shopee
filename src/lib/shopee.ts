import crypto from 'crypto';

// Shopee API Configuration
const PARTNER_ID = process.env.SHOPEE_PARTNER_ID || '';
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || '';
const API_URL = process.env.SHOPEE_API_URL || 'https://partner.test-stable.shopeemobile.com';

/**
 * Generate HMAC-SHA256 signature for Shopee API
 */
export function generateSign(
  partnerId: string,
  path: string,
  timestamp: number,
  accessToken?: string,
  shopId?: number
): string {
  let baseString = `${partnerId}${path}${timestamp}`;

  if (accessToken) {
    baseString += accessToken;
  }

  if (shopId) {
    baseString += shopId;
  }

  return crypto
    .createHmac('sha256', PARTNER_KEY)
    .update(baseString)
    .digest('hex');
}

/**
 * Generate OAuth authorization URL
 */
export function generateAuthLink(redirectUrl: string): string {
  const path = '/api/v2/shop/auth_partner';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    sign: sign,
    redirect: redirectUrl,
  });

  return `${API_URL}${path}?${params.toString()}`;
}

/**
 * Get access token from authorization code
 */
export async function getAccessToken(code: string, shopId: number) {
  const path = '/api/v2/auth/token/get';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp);

  const url = `${API_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: code,
      shop_id: shopId,
      partner_id: parseInt(PARTNER_ID),
    }),
  });

  return response.json();
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string, shopId: number) {
  const path = '/api/v2/auth/access_token/get';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp);

  const url = `${API_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      shop_id: shopId,
      partner_id: parseInt(PARTNER_ID),
    }),
  });

  return response.json();
}

/**
 * Generic Shopee API caller
 */
export async function callShopeeAPI(
  path: string,
  accessToken: string,
  shopId: number,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
) {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId.toString(),
    sign: sign,
  });

  const url = `${API_URL}${path}?${params.toString()}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return response.json();
}

/**
 * Get shop info
 */
export async function getShopInfo(accessToken: string, shopId: number) {
  return callShopeeAPI('/api/v2/shop/get_shop_info', accessToken, shopId);
}

/**
 * Get item base info (including item_name, description, etc.)
 */
export async function getItemBaseInfo(
  accessToken: string,
  shopId: number,
  itemIdList: number[]
) {
  const path = '/api/v2/product/get_item_base_info';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId.toString(),
    sign: sign,
    item_id_list: itemIdList.join(','),
  });

  const url = `${API_URL}${path}?${params.toString()}`;
  const response = await fetch(url);
  return response.json();
}

/**
 * Get product list with item names
 * First calls get_item_list, then get_item_base_info to enrich with item_name
 */
export async function getProductList(
  accessToken: string,
  shopId: number,
  offset: number = 0,
  pageSize: number = 20
) {
  // Step 1: Get item list
  const path = '/api/v2/product/get_item_list';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId.toString(),
    sign: sign,
    offset: offset.toString(),
    page_size: pageSize.toString(),
    item_status: 'NORMAL',
  });

  const url = `${API_URL}${path}?${params.toString()}`;
  const response = await fetch(url);
  const itemListResult = await response.json();

  // Step 2: If we have items, get their base info (including item_name)
  if (
    itemListResult.response?.item &&
    itemListResult.response.item.length > 0
  ) {
    const itemIds = itemListResult.response.item.map(
      (item: { item_id: number }) => item.item_id
    );

    const baseInfoResult = await getItemBaseInfo(accessToken, shopId, itemIds);

    // Step 3: Merge item_name into the original item list
    if (baseInfoResult.response?.item_list) {
      const baseInfoMap = new Map<number, { item_name: string; image: { image_url_list: string[] } }>();
      baseInfoResult.response.item_list.forEach(
        (info: { item_id: number; item_name: string; image: { image_url_list: string[] } }) => {
          baseInfoMap.set(info.item_id, {
            item_name: info.item_name,
            image: info.image,
          });
        }
      );

      // Enrich original items with item_name and image
      itemListResult.response.item = itemListResult.response.item.map(
        (item: { item_id: number }) => {
          const baseInfo = baseInfoMap.get(item.item_id);
          return {
            ...item,
            item_name: baseInfo?.item_name || '',
            image: baseInfo?.image || { image_url_list: [] },
          };
        }
      );
    }
  }

  return itemListResult;
}

/**
 * Get model list (variants) for a product
 */
export async function getModelList(
  accessToken: string,
  shopId: number,
  itemId: number
) {
  const path = '/api/v2/product/get_model_list';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId.toString(),
    sign: sign,
    item_id: itemId.toString(),
  });

  const url = `${API_URL}${path}?${params.toString()}`;
  const response = await fetch(url);
  return response.json();
}

/**
 * Get order list
 */
export async function getOrderList(
  accessToken: string,
  shopId: number,
  timeFrom: number,
  timeTo: number,
  pageSize: number = 20,
  cursor?: string
) {
  const path = '/api/v2/order/get_order_list';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId.toString(),
    sign: sign,
    time_range_field: 'create_time',
    time_from: timeFrom.toString(),
    time_to: timeTo.toString(),
    page_size: pageSize.toString(),
  });

  if (cursor) {
    params.append('cursor', cursor);
  }

  const url = `${API_URL}${path}?${params.toString()}`;
  const response = await fetch(url);
  return response.json();
}

/**
 * Get order details
 */
export async function getOrderDetail(
  accessToken: string,
  shopId: number,
  orderSnList: string[]
) {
  const path = '/api/v2/order/get_order_detail';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId.toString(),
    sign: sign,
    order_sn_list: orderSnList.join(','),
  });

  const url = `${API_URL}${path}?${params.toString()}`;
  console.log('getOrderDetail URL:', url);
  console.log('order_sn_list:', orderSnList.join(','));
  const response = await fetch(url);
  const result = await response.json();
  console.log('getOrderDetail Response:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Stock item for batch update
 */
interface StockItem {
  model_id: number;
  stock: number;
}

/**
 * Update product stock - supports multiple models
 */
export async function updateStock(
  accessToken: string,
  shopId: number,
  itemId: number,
  stockItems: StockItem[]
) {
  const path = '/api/v2/product/update_stock';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId.toString(),
    sign: sign,
  });

  const url = `${API_URL}${path}?${params.toString()}`;

  // Build stock_list for all models
  const stock_list = stockItems.map(item => ({
    model_id: item.model_id,
    seller_stock: [
      {
        stock: item.stock,
      },
    ],
  }));

  const body = {
    item_id: itemId,
    stock_list: stock_list,
  };

  console.log('updateStock URL:', url);
  console.log('updateStock Body:', JSON.stringify(body, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log('updateStock Response:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Delete a model (variant) from a product
 */
export async function deleteModel(
  accessToken: string,
  shopId: number,
  itemId: number,
  modelId: number
) {
  const path = '/api/v2/product/delete_model';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId.toString(),
    sign: sign,
  });

  const url = `${API_URL}${path}?${params.toString()}`;

  const body = {
    item_id: itemId,
    model_id: modelId,
  };

  console.log('deleteModel URL:', url);
  console.log('deleteModel Body:', JSON.stringify(body, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log('deleteModel Response:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Tier variation option
 */
interface TierVariationOption {
  option: string;
  image?: {
    image_id: string;
  };
}

/**
 * Tier variation structure
 */
interface TierVariation {
  name: string;
  option_list: TierVariationOption[];
}

/**
 * Model info for update_tier_variation
 */
interface ModelInfo {
  tier_index: number[];
  model_sku?: string;
}

/**
 * Update tier variation - used for deleting variation options
 * This API can add, delete, or update tier variation options
 */
export async function updateTierVariation(
  accessToken: string,
  shopId: number,
  itemId: number,
  tierVariation: TierVariation[],
  model?: ModelInfo[]
) {
  const path = '/api/v2/product/update_tier_variation';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(PARTNER_ID, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId.toString(),
    sign: sign,
  });

  const url = `${API_URL}${path}?${params.toString()}`;

  const body: {
    item_id: number;
    tier_variation: TierVariation[];
    model?: ModelInfo[];
  } = {
    item_id: itemId,
    tier_variation: tierVariation,
  };

  if (model) {
    body.model = model;
  }

  console.log('updateTierVariation URL:', url);
  console.log('updateTierVariation Body:', JSON.stringify(body, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log('updateTierVariation Response:', JSON.stringify(result, null, 2));
  return result;
}

