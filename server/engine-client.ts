const DELIVERY_HEADER = 'X-Token-Delivery-Secret';

export interface TokenDeliveryResult {
  delivered: boolean;
  status?: number;
  error?: string;
}

export async function deliverTokensToEngine(
  shop: string,
  accessToken: string,
  refreshToken: string | null,
  opts: { engineUrl?: string; secret?: string; fetchImpl?: typeof fetch; scope?: string | null } = {},
): Promise<TokenDeliveryResult> {
  const engineUrl = opts.engineUrl ?? process.env.COMPLIANCE_ENGINE_URL ?? 'http://localhost:8000';
  const secret = opts.secret ?? process.env.SHOPIFY_TOKEN_DELIVERY_SECRET ?? '';
  if (!secret) {
    console.error('[delivery] SHOPIFY_TOKEN_DELIVERY_SECRET not set — engine was not updated');
    return { delivered: false, error: 'not_configured' };
  }
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${engineUrl}/webhooks/shopify/register-webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [DELIVERY_HEADER]: secret },
      body: JSON.stringify({
        shop,
        access_token: accessToken,
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        ...(opts.scope ? { scope: opts.scope } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`[delivery] engine rejected token delivery for ${shop}: HTTP ${res.status}`);
      return { delivered: false, status: res.status, error: 'engine_rejected' };
    }
    return { delivered: true, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[delivery] token delivery failed for ${shop}: ${msg}`);
    return { delivered: false, error: 'transport_error' };
  }
}
