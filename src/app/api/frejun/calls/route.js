// src/app/api/frejun/calls/route.js
import { getSessionFromRequest } from '@/lib/ornaverse/session';
import { getFrejunCalls } from '@/lib/frejun/frejunClient';
import { enrichCallsWithCustomerNames } from '@/lib/frejun/customerNameResolver';
import { FREJUN_STORES, identifyStoreForCall, getStoreByKey } from '@/lib/frejun/storeMapping';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize') || searchParams.get('page_size')) || 50;
  let userEmail = searchParams.get('userEmail') || searchParams.get('user_email') || '';
  const candidateNumber = searchParams.get('candidateNumber') || searchParams.get('candidate_number') || '';
  const dateStart = searchParams.get('dateStart') || searchParams.get('date_start') || '';
  const dateEnd = searchParams.get('dateEnd') || searchParams.get('date_end') || '';
  const callId = searchParams.get('callId') || searchParams.get('call_id') || '';
  const storeKey = (searchParams.get('store') || searchParams.get('storeKey') || '').toLowerCase().trim();
  const tag = (searchParams.get('tag') || '').toLowerCase().trim();
  const search = searchParams.get('search') || '';

  // If a store key was passed (e.g. 'chembur', 'borivali') and no userEmail is explicitly given:
  let selectedStore = null;
  if (storeKey && storeKey !== 'all') {
    selectedStore = getStoreByKey(storeKey) || FREJUN_STORES.find((s) => s.match.test(storeKey));
    if (selectedStore && !userEmail) {
      userEmail = selectedStore.email;
    }
  }

  // If general search is provided and candidateNumber is empty, determine if search is a phone or email
  let resolvedNumber = candidateNumber;
  let resolvedEmail = userEmail;
  if (search && !resolvedNumber && !resolvedEmail) {
    const clean = search.trim();
    if (clean.includes('@')) {
      resolvedEmail = clean;
    } else {
      resolvedNumber = clean;
    }
  }

  try {
    const data = await getFrejunCalls({
      page,
      pageSize,
      userEmail: resolvedEmail,
      candidateNumber: resolvedNumber,
      dateStart,
      dateEnd,
      callId,
    });

    let results = data?.results ?? [];

    // Filter by specific tag or agent if requested (only when not matching the store itself)
    if (tag && tag !== 'all') {
      const isStoreTag = selectedStore && (
        selectedStore.tags?.some((t) => t.toLowerCase() === tag) ||
        selectedStore.key.toLowerCase() === tag ||
        selectedStore.label.toLowerCase().includes(tag)
      );

      // Only apply post-fetch tag filter if it's an explicit agent/sub-tag, not the store filter itself
      if (!isStoreTag) {
        results = results.filter((call) => {
          const hasMatchingTag = Array.isArray(call.tags) && call.tags.some((t) => t.name?.toLowerCase().includes(tag));
          const hasMatchingRecruiter = call.recruiter?.toLowerCase().includes(tag);
          return hasMatchingTag || hasMatchingRecruiter;
        });
      }
    }

    // Attach identified store to each call
    results.forEach((call) => {
      const storeObj = identifyStoreForCall(call);
      if (storeObj) {
        call.store = {
          key: storeObj.key,
          label: storeObj.label,
          email: storeObj.email,
          virtualNumber: storeObj.virtualNumber,
        };
      }
    });

    // Enrich missing customer names from MongoDB (purchases, walkins) and Zoho CRM Leads
    await enrichCallsWithCustomerNames(results);

    return Response.json({
      ok: true,
      data: {
        ...data,
        results,
      },
    });
  } catch (err) {
    console.error('[API /api/frejun/calls] Error:', err);
    return Response.json(
      {
        ok: false,
        error: err.message || 'Failed to fetch Frejun call logs',
      },
      { status: 500 }
    );
  }
}
