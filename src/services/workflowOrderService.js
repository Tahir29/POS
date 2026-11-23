// src/services/workflowOrderService.js

/**
 * Service to query workflow orders from /api/pos/workflow-orders
 */
export async function fetchWorkflowOrders(params = {}) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  }

  const res = await fetch(`/api/pos/workflow-orders?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `Failed to fetch workflow orders (status: ${res.status})`);
  }

  return res.json();
}
