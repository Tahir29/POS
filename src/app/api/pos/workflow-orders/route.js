// src/app/api/pos/workflow-orders/route.js
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/ornaverse/session';
import { getWorkflowOrders } from '@/lib/workflow/workflowOrdersClient';

export const dynamic = 'force-dynamic';

const EXPECTED_API_KEY = process.env.WORKFLOW_ORDERS_API_KEY || 'pos_sec_live_9f81a742c03b';

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
  };
}

/**
 * Validates request authentication:
 * 1. Checks x-api-key header
 * 2. Checks Authorization Bearer header
 * 3. Falls back to active POS session cookie
 */
async function authenticateRequest(request) {
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader && apiKeyHeader === EXPECTED_API_KEY) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1] === EXPECTED_API_KEY) {
      return true;
    }
  }

  // Also allow active cashier session from POS frontend
  const session = await getSessionFromRequest(request);
  if (session) {
    return true;
  }

  return false;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export async function GET(request) {
  const isAuth = await authenticateRequest(request);
  if (!isAuth) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Invalid or missing API key.',
      },
      {
        status: 401,
        headers: getCorsHeaders(),
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const params = {
      search: searchParams.get('search') || searchParams.get('query') || '',
      query: searchParams.get('query') || '',
      order_number: searchParams.get('order_number') || '',
      po_number: searchParams.get('po_number') || '',
      document_no: searchParams.get('document_no') || '',
      step: searchParams.get('step') || 'all',
      status: searchParams.get('status') || '',
      from_date: searchParams.get('from_date') || '',
      to_date: searchParams.get('to_date') || '',
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
    };

    const result = await getWorkflowOrders(params);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal Server Error while querying workflow orders.',
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      }
    );
  }
}

// Strictly Read-Only handlers: return 405 Method Not Allowed
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed. Workflow Orders API is strictly read-only.' },
    { status: 405, headers: getCorsHeaders() }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed. Workflow Orders API is strictly read-only.' },
    { status: 405, headers: getCorsHeaders() }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed. Workflow Orders API is strictly read-only.' },
    { status: 405, headers: getCorsHeaders() }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed. Workflow Orders API is strictly read-only.' },
    { status: 405, headers: getCorsHeaders() }
  );
}
