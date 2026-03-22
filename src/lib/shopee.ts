import crypto from 'crypto';

export const BASE_URLS: Record<string, string> = {
  test: 'https://partner.test-stable.shopeemobile.com',
  live: 'https://partner.shopeemobile.com',
};

/**
 * Generate HMAC-SHA256 signature for Shopee API requests.
 * For shop-level endpoints: baseStr = partnerId + path + timestamp + accessToken + shopId
 * For auth endpoints (no shop context): baseStr = partnerId + path + timestamp
 */
export function generateSignature(
  partnerId: number,
  partnerKey: string,
  path: string,
  timestamp: number,
  accessToken?: string,
  shopId?: number,
): string {
  const parts: (string | number)[] = [partnerId, path, timestamp];
  if (accessToken !== undefined && shopId !== undefined) {
    parts.push(accessToken, shopId);
  }
  const baseStr = parts.join('');
  return crypto.createHmac('sha256', partnerKey).update(baseStr).digest('hex');
}

/**
 * Build the Shopee OAuth authorization URL that the merchant is redirected to.
 * https://open.shopee.com/documents/v2/OpenAPI_Guide#section-3-partner-level-api-authorization
 */
export function buildAuthUrl(
  env: 'test' | 'live',
  partnerId: number,
  partnerKey: string,
  redirectUrl: string,
): string {
  const baseUrl = BASE_URLS[env] ?? BASE_URLS.test;
  const path = '/api/v2/shop/auth_partner';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(partnerId, partnerKey, path, timestamp);

  const params = new URLSearchParams({
    partner_id: String(partnerId),
    timestamp: String(timestamp),
    sign,
    redirect: redirectUrl,
  });

  return `${baseUrl}${path}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access_token and shop_id.
 * https://open.shopee.com/documents/v2/OpenAPI_Guide#section-3-get-access-token
 */
export async function exchangeCodeForToken(
  env: 'test' | 'live',
  partnerId: number,
  partnerKey: string,
  code: string,
  shopId: number,
): Promise<{ access_token: string; refresh_token: string; shop_id: number }> {
  const baseUrl = BASE_URLS[env] ?? BASE_URLS.test;
  const path = '/api/v2/auth/token/get';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(partnerId, partnerKey, path, timestamp);

  const body = {
    code,
    shop_id: shopId,
    partner_id: partnerId,
  };

  const params = new URLSearchParams({
    partner_id: String(partnerId),
    timestamp: String(timestamp),
    sign,
  });

  const res = await fetch(`${baseUrl}${path}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Shopee token exchange HTTP error: ${res.status}`);
  }

  const json = await res.json();
  if (json.error && json.error !== '') {
    throw new Error(`Shopee token exchange error: ${json.error} — ${json.message}`);
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    shop_id: json.shop_id ?? shopId,
  };
}

export function toUnixTs(dateStr: string, endOfDay = false): number {
  const d = new Date(dateStr);
  if (endOfDay) {
    d.setUTCHours(23, 59, 59, 999);
  } else {
    d.setUTCHours(0, 0, 0, 0);
  }
  return Math.floor(d.getTime() / 1000);
}
