import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, LogSeverity, Session, type Shopify } from '@shopify/shopify-api';
import { restResources } from '@shopify/shopify-api/rest/admin/2024-10';
import { config } from './config';

export const shopify: Shopify = shopifyApi({
  apiKey: config.shopify.apiKey,
  apiSecretKey: config.shopify.apiSecret,
  scopes: config.shopify.scopes,
  hostName: config.shopify.appUrl.replace(/https?:\/\//, ''),
  hostScheme: config.shopify.appUrl.startsWith('https') ? 'https' : 'http',
  apiVersion: ApiVersion.October24,
  isEmbeddedApp: true,
  logLevel: LogSeverity.Warning,
  restResources,
});

export function buildSession(shop: string, accessToken: string): Session {
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: '',
    isOnline: false,
    accessToken,
    scope: config.shopify.scopes.join(', '),
  });
}
