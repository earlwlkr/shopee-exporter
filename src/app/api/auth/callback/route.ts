import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/shopee';

/**
 * GET /api/auth/callback
 *
 * Shopee redirects here after the merchant authorizes the app.
 * Query params from Shopee: code, shop_id, and optionally main_account_id.
 *
 * We also expect partnerId, partnerKey, and env to be forwarded as query
 * params in the redirect URL we constructed (see buildAuthUrl usage on the
 * client side).
 *
 * After exchanging the code, we redirect back to the dashboard with
 * shop_id and access_token as URL search params so the UI can auto-populate.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const code = searchParams.get('code');
  const shopIdStr = searchParams.get('shop_id');
  const partnerId = searchParams.get('partner_id');
  const partnerKey = searchParams.get('partner_key');
  const env = (searchParams.get('env') ?? 'test') as 'test' | 'live';

  if (!code || !shopIdStr || !partnerId || !partnerKey) {
    return NextResponse.json(
      { error: 'Missing required query parameters: code, shop_id, partner_id, partner_key' },
      { status: 400 },
    );
  }

  try {
    const result = await exchangeCodeForToken(
      env,
      Number(partnerId),
      partnerKey,
      code,
      Number(shopIdStr),
    );

    // Redirect back to the dashboard with credentials in URL params.
    // NOTE: In production you should store these server-side (e.g. in a
    // database or encrypted cookie) rather than exposing them in the URL.
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('shop_id', String(result.shop_id));
    redirectUrl.searchParams.set('access_token', result.access_token);

    return NextResponse.redirect(redirectUrl.toString());
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
