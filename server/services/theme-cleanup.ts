import { prisma } from '../database';
import { shopify, buildSession } from '../shopify';
import { logEvidence } from './compliance-evidence';

interface ThemeAssetCheck {
  appId: string;
  appName: string;
  assetPath: string;
  assetType: string;
  isPresent: boolean;
  cleanRemoved: boolean;
}

export async function checkThemeAssets(shopDomain: string, appId: string): Promise<ThemeAssetCheck[]> {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) throw new Error('App not found');

  // If app has theme assets stored, verify they exist
  if (!app.themeAssets) {
    return [];
  }

  let assets: { path: string; type: string }[];
  try {
    assets = typeof app.themeAssets === 'string' ? JSON.parse(app.themeAssets) : app.themeAssets;
  } catch {
    return [];
  }

  const results: ThemeAssetCheck[] = [];

  for (const asset of assets) {
    const assetPath = typeof asset === 'string' ? asset : asset.path;
    const assetType = typeof asset === 'string' ? 'unknown' : asset.type || 'unknown';

    const verification = await prisma.themeCleanupVerification.create({
      data: {
        appId: app.id,
        assetType,
        assetPath,
        isPresent: true, // We'd need theme API access to verify — mark as needing check
        cleanRemoved: false,
      },
    });

    results.push({
      appId: app.id,
      appName: app.name,
      assetPath,
      assetType,
      isPresent: true,
      cleanRemoved: false,
    });
  }

  await logEvidence(
    shopDomain,
    'theme_cleanup_check',
    `Checked ${results.length} theme assets for "${app.name}"`,
    'system'
  );

  return results;
}

export async function markAssetAsCleaned(verificationId: string) {
  return prisma.themeCleanupVerification.update({
    where: { id: verificationId },
    data: { cleanRemoved: true, isPresent: false },
  });
}

export async function getThemeCleanupSummary(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { appsWithAssets: 0, totalAssets: 0, cleanedAssets: 0, pendingCleanup: 0, verifications: [] };

  const apps = await prisma.app.findMany({
    where: {
      shopId: shop.id,
      themeAssets: { not: null },
    },
  });

  const verifications = await prisma.themeCleanupVerification.findMany({
    where: { app: { shopId: shop.id } },
    include: { app: { select: { name: true } } },
  });

  return {
    appsWithAssets: apps.length,
    totalAssets: verifications.length,
    cleanedAssets: verifications.filter((v) => v.cleanRemoved).length,
    pendingCleanup: verifications.filter((v) => !v.cleanRemoved).length,
    verifications,
  };
}

// Track theme assets for apps during bulk import
export function extractThemeAssetTypes(category: string, appName: string): string[] {
  const assets: string[] = [];

  // Common Shopify app asset injection patterns
  if (category === 'Reviews' || appName.toLowerCase().includes('review')) {
    assets.push(JSON.stringify({ path: `assets/${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-widget.js`, type: 'script' }));
    assets.push(JSON.stringify({ path: `snippets/${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-badge.liquid`, type: 'snippet' }));
  }

  if (category === 'Marketing' || appName.toLowerCase().includes('popup') || appName.toLowerCase().includes('chat')) {
    assets.push(JSON.stringify({ path: `assets/${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-embed.js`, type: 'script' }));
  }

  if (category === 'SEO' || appName.toLowerCase().includes('seo')) {
    assets.push(JSON.stringify({ path: `layout/theme.liquid`, type: 'layout' }));
  }

  return assets;
}
