// Run: npx esbuild server/engine-client.test.ts --bundle --platform=node --format=esm --outfile=/tmp/ec.test.mjs && node --test /tmp/ec.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliverTokensToEngine } from './engine-client';

const SECRET = 'test-secret';

function fakeFetch(ok: boolean, status = 200) {
  const calls: any[] = [];
  const impl = async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok, status } as any;
  };
  return { impl, calls };
}

test('delivers credentials with the delivery secret header', async () => {
  const { impl, calls } = fakeFetch(true);
  const res = await deliverTokensToEngine('shop.myshopify.com', 'shpat_x', 'shprt_y', {
    engineUrl: 'http://engine:8000',
    secret: SECRET,
    fetchImpl: impl as any,
  });
  assert.equal(res.delivered, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://engine:8000/webhooks/shopify/register-webhooks');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['X-Token-Delivery-Secret'], SECRET);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.shop, 'shop.myshopify.com');
  assert.equal(body.access_token, 'shpat_x');
  assert.equal(body.refresh_token, 'shprt_y');
});

test('reports engine rejection without throwing', async () => {
  const { impl, calls } = fakeFetch(false, 502);
  const res = await deliverTokensToEngine('shop.myshopify.com', 'shpat_x', null, {
    engineUrl: 'http://engine:8000',
    secret: SECRET,
    fetchImpl: impl as any,
  });
  assert.equal(res.delivered, false);
  assert.equal(res.status, 502);
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].init.body);
  assert.equal('refresh_token' in body, false);
});

test('refuses to deliver when the secret is not configured', async () => {
  const { impl, calls } = fakeFetch(true);
  const res = await deliverTokensToEngine('shop.myshopify.com', 'shpat_x', null, {
    engineUrl: 'http://engine:8000',
    secret: '',
    fetchImpl: impl as any,
  });
  assert.equal(res.delivered, false);
  assert.equal(res.error, 'not_configured');
  assert.equal(calls.length, 0);
});

test('sends the granted scope when the install path has it', async () => {
  const { impl, calls } = fakeFetch(true);
  await deliverTokensToEngine('shop.myshopify.com', 'shpat_x', 'shprt_y', {
    engineUrl: 'http://engine:8000',
    secret: SECRET,
    scope: 'read_customers,write_customers,read_orders',
    fetchImpl: impl as any,
  });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.scope, 'read_customers,write_customers,read_orders');
});

test('omits scope on a refresh (the engine keeps the scope it already merged)', async () => {
  const { impl, calls } = fakeFetch(true);
  await deliverTokensToEngine('shop.myshopify.com', 'shpat_x', 'shprt_y', {
    engineUrl: 'http://engine:8000',
    secret: SECRET,
    fetchImpl: impl as any,
  });
  const body = JSON.parse(calls[0].init.body);
  assert.equal('scope' in body, false);
});
