import { shopify, buildSession } from '../shopify';
import { prisma } from '../database';

const APP_INSTALLATIONS_QUERY = `
  query {
    appInstallations {
      id
      app {
        id
        title
        handle
        developerName
        pricing {
          price
          interval
        }
      }
      accessScopes {
        handle
        description
      }
      createdAt
    }
  }
`;

export async function submitAppInventoryBulkOperation(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop?.accessToken) throw new Error('No session for shop');
  const session = buildSession(shopDomain, shop.accessToken);

  const client = new shopify.clients.Graphql({ session });

  const response = await client.query({
    data: {
      query: `
        mutation {
          bulkOperationRunQuery(
            query: """${APP_INSTALLATIONS_QUERY}"""
          ) {
            bulkOperation {
              id
              status
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
    },
  });

  const bulkOp = (response.body as any)?.data?.bulkOperationRunQuery?.bulkOperation;
  if (!bulkOp) throw new Error('Failed to create bulk operation');

  const dbOp = await prisma.bulkOperation.create({
    data: {
      id: bulkOp.id,
      shopId: shop.id,
      queryType: 'app_installations',
      status: bulkOp.status,
    },
  });

  return dbOp;
}

export async function pollBulkOperation(shopDomain: string, operationId: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop?.accessToken) throw new Error('No session for shop');
  const session = buildSession(shopDomain, shop.accessToken);

  const client = new shopify.clients.Graphql({ session });

  const response = await client.query({
    data: {
      query: `
        query {
          node(id: "${operationId}") {
            ... on BulkOperation {
              id
              status
              errorCode
              createdAt
              completedAt
              objectCount
              url
              type
            }
          }
        }
      `,
    },
  });

  const operation = (response.body as any)?.data?.node;
  if (!operation) throw new Error('Operation not found');

  await prisma.bulkOperation.update({
    where: { id: operationId },
    data: {
      status: operation.status,
      url: operation.url,
      objectCount: operation.objectCount,
      completedAt: operation.completedAt ? new Date(operation.completedAt) : null,
      errorCode: operation.errorCode,
    },
  });

  return operation;
}

export async function downloadAndProcessBulkData(operationId: string) {
  const operation = await prisma.bulkOperation.findUnique({ where: { id: operationId } });
  if (!operation?.url) throw new Error('No download URL available');

  const response = await fetch(operation.url);
  const text = await response.text();
  const lines = text.trim().split('\n').map((line) => JSON.parse(line));

  return lines;
}

export async function handleBulkOperationWebhook(payload: any) {
  const { admin_graphql_api_id, status, url, object_count, error_code } = payload;

  await prisma.bulkOperation.update({
    where: { id: admin_graphql_api_id },
    data: {
      status,
      url,
      objectCount: object_count,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      errorCode: error_code,
    },
  });

  if (status === 'COMPLETED') {
    const op = await prisma.bulkOperation.findUnique({ where: { id: admin_graphql_api_id } });
    if (op) {
      const data = await downloadAndProcessBulkData(admin_graphql_api_id);
      const { ingestAppInstallations } = await import('./app-graph');
      await ingestAppInstallations(op.shopId, data);
    }
  }
}
