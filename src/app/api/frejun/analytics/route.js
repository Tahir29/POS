// src/app/api/frejun/analytics/route.js
import { getSessionFromRequest } from '@/lib/ornaverse/session';
import { getFrejunAnalytics } from '@/lib/frejun/frejunClient';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateStart = searchParams.get('dateStart') || searchParams.get('date_start') || '';
  const dateEnd = searchParams.get('dateEnd') || searchParams.get('date_end') || '';
  const users = searchParams.get('users') || '';

  try {
    const data = await getFrejunAnalytics({
      dateStart,
      dateEnd,
      users,
    });

    return Response.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('[API /api/frejun/analytics] Error:', err);
    return Response.json(
      {
        ok: false,
        error: err.message || 'Failed to fetch Frejun call analytics',
      },
      { status: 500 }
    );
  }
}
