import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const BASE_URLS: Record<string, string> = {
  test: 'https://partner.test-stable.shopeemobile.com',
  live: 'https://partner.shopeemobile.com',
};

function generateSignature(
  partnerId: number,
  partnerKey: string,
  path: string,
  timestamp: number,
  accessToken: string,
  shopId: number,
): string {
  const baseStr = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', partnerKey).update(baseStr).digest('hex');
}

function toUnixTs(dateStr: string, endOfDay = false): number {
  const d = new Date(dateStr);
  if (endOfDay) {
    d.setUTCHours(23, 59, 59, 999);
  } else {
    d.setUTCHours(0, 0, 0, 0);
  }
  return Math.floor(d.getTime() / 1000);
}

interface ShopeeOrder {
  order_sn: string;
  order_status: string;
  create_time: number;
  update_time: number;
  [key: string]: unknown;
}

async function getOrderList(
  baseUrl: string,
  partnerId: number,
  partnerKey: string,
  shopId: number,
  accessToken: string,
  timeFrom: number,
  timeTo: number,
): Promise<ShopeeOrder[]> {
  const path = '/api/v2/order/get_order_list';
  const orders: ShopeeOrder[] = [];
  let cursor = '';
  let hasMore = true;

  while (hasMore) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSignature(partnerId, partnerKey, path, timestamp, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: String(partnerId),
      timestamp: String(timestamp),
      sign,
      shop_id: String(shopId),
      access_token: accessToken,
      time_range_field: 'create_time',
      time_from: String(timeFrom),
      time_to: String(timeTo),
      page_size: '100',
      response_optional_fields: 'order_status',
    });
    if (cursor) params.set('cursor', cursor);

    const url = `${baseUrl}${path}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Shopee API HTTP error: ${res.status}`);

    const json = await res.json();
    if (json.error && json.error !== '') {
      throw new Error(`Shopee API error: ${json.error} — ${json.message}`);
    }

    const responseData = json.response ?? {};
    const orderList: ShopeeOrder[] = responseData.order_list ?? [];
    orders.push(...orderList);

    hasMore = responseData.more ?? false;
    cursor = responseData.next_cursor ?? '';
  }

  return orders;
}

async function getOrderDetail(
  baseUrl: string,
  partnerId: number,
  partnerKey: string,
  shopId: number,
  accessToken: string,
  orderSnList: string[],
): Promise<ShopeeOrder[]> {
  const path = '/api/v2/order/get_order_detail';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(partnerId, partnerKey, path, timestamp, accessToken, shopId);

  const params = new URLSearchParams({
    partner_id: String(partnerId),
    timestamp: String(timestamp),
    sign,
    shop_id: String(shopId),
    access_token: accessToken,
    order_sn_list: orderSnList.join(','),
    response_optional_fields:
      'buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,goods_to_declare,note,note_update_time,pay_time,dropshipper,credit_card_number,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee_confirmed,buyer_cpf_id,fulfillment_flag,pickup_done_time,package_list,shipping_carrier,payment_method,total_amount,buyer_username,invoice_data,checkout_shipping_carrier,reverse_shipping_fee,order_chargeable_weight_gram,edt,prescription_images,prescription_check_status',
  });

  const url = `${baseUrl}${path}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Shopee API HTTP error: ${res.status}`);

  const json = await res.json();
  if (json.error && json.error !== '') {
    throw new Error(`Shopee API error: ${json.error} — ${json.message}`);
  }

  return json.response?.order_list ?? [];
}

function ordersToCSV(orders: ShopeeOrder[]): string {
  if (orders.length === 0) return 'No orders found';

  // Collect all unique keys
  const keys = new Set<string>();
  orders.forEach(o => Object.keys(o).forEach(k => keys.add(k)));
  const headers = Array.from(keys);

  const escape = (val: unknown): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [headers.join(',')];
  for (const order of orders) {
    rows.push(headers.map(h => escape(order[h])).join(','));
  }
  return rows.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { partnerId, partnerKey, shopId, accessToken, env, dateFrom, dateTo } = body as {
      partnerId: string;
      partnerKey: string;
      shopId: string;
      accessToken: string;
      env: 'test' | 'live';
      dateFrom: string;
      dateTo: string;
    };

    const baseUrl = BASE_URLS[env] ?? BASE_URLS.test;
    const timeFrom = toUnixTs(dateFrom, false);
    const timeTo = toUnixTs(dateTo, true);

    const orderList = await getOrderList(
      baseUrl,
      Number(partnerId),
      partnerKey,
      Number(shopId),
      accessToken,
      timeFrom,
      timeTo,
    );

    let detailedOrders: ShopeeOrder[] = [];
    // Fetch details in batches of 50
    for (let i = 0; i < orderList.length; i += 50) {
      const batch = orderList.slice(i, i + 50).map(o => o.order_sn);
      const details = await getOrderDetail(
        baseUrl,
        Number(partnerId),
        partnerKey,
        Number(shopId),
        accessToken,
        batch,
      );
      detailedOrders = detailedOrders.concat(details);
    }

    const csv = ordersToCSV(detailedOrders.length > 0 ? detailedOrders : orderList);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="shopee-orders.csv"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
