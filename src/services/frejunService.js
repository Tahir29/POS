// src/services/frejunService.js

/**
 * Fetch paginated calls from /api/frejun/calls
 */
export async function getFrejunCalls(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.set(key, String(value));
    }
  }

  const res = await fetch(`/api/frejun/calls?${query.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `Failed to fetch call logs (${res.status})`);
  }

  const json = await res.json();
  return json?.data ?? { count: 0, next: null, previous: null, results: [] };
}

/**
 * Fetch staff call analytics from /api/frejun/analytics
 */
export async function getFrejunAnalytics(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.set(key, String(value));
    }
  }

  const res = await fetch(`/api/frejun/analytics?${query.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `Failed to fetch call analytics (${res.status})`);
  }

  const json = await res.json();
  return json?.data ?? [];
}
