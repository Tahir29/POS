'use client';

// Dedicated route for a completed sale — was an inline component swap
// inside checkout/page.jsx (isConfirmed && <OrderConfirmationScreen />);
// moved to its own page (2026-09-07) per explicit product decision: a real
// URL for "this sale is done" that survives a refresh, can be bookmarked/
// reopened, and reads unambiguously in the browser's own back/forward
// history — an inline swap on /checkout could not do any of that, and a
// stray back-navigation risked landing an operator back on a "confirmed"
// checkout screen with no cart left to show.
//
// transactionId/documentType/coinsRedeemed travel via the URL
// (?transactionId=&documentType=&coinsRedeemed=) rather than as component
// props — checkout/page.jsx pushes this route right after
// placeOrder/placeInvoice resolves; see that file's handlePaymentConfirmed
// for the write side of this contract.
//
// coinsRedeemed (2026-09-08) — Lucira Coins redeemed on this sale aren't a
// field on the OrnaVerse document itself (coins aren't an OrnaVerse
// concept — see CartSummary's own header), so there's nowhere else for
// OrderConfirmationScreen to read this back from once this page reloads;
// carried forward the same lightweight way transactionId/documentType
// already are.

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OrderConfirmationScreen from '@/components/features/checkout/OrderConfirmationScreen';

function OrderSuccessScreen() {
  const router = useRouter();
  const params = useSearchParams();

  const transactionId  = Number(params.get('transactionId')) || null;
  const documentType   = params.get('documentType') === 'order' ? 'order' : 'invoice';
  const coinsRedeemed  = Number(params.get('coinsRedeemed')) || 0;

  // Defensive — this route only ever makes sense right after a real
  // create/post succeeded (see checkout/page.jsx). Landing here any other
  // way (a bookmarked/shared link, a stray back-navigation with a stale
  // query string) has nothing to confirm, so send the operator somewhere
  // that does rather than showing a screen permanently stuck on "Loading
  // invoice…" — OrderConfirmationScreen's own Retrieve never resolves
  // without a real id.
  useEffect(() => {
    if (!transactionId) router.replace('/catalog');
  }, [transactionId, router]);

  if (!transactionId) return null;

  return (
    <div className="max-w-3xl mx-auto w-full p-4 md:p-6">
      <OrderConfirmationScreen
        transactionId={transactionId}
        documentType={documentType}
        coinsRedeemed={coinsRedeemed}
      />
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={null}>
      <OrderSuccessScreen />
    </Suspense>
  );
}
