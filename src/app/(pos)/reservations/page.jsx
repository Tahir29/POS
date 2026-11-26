'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bookmark, ChevronDown, Loader2, RefreshCw, ShoppingBag, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { listReserves, retrieveReserve, cancelReserve } from '@/services/reserveService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { formatAmount } from '@/lib/priceUtils';

const STATUS = {
  0: { label: 'Draft', cls: 'bg-muted text-muted-foreground' },
  1: { label: 'Reserved', cls: 'bg-status-success/15 text-status-success' },
  2: { label: 'Cancelled', cls: 'bg-status-error/15 text-status-error' },
};

const FILTERS = [['active', 'Reserved'], ['cancelled', 'Cancelled'], ['all', 'All']];

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function ReserveItems({ id }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reserves', 'detail', id],
    queryFn: () => retrieveReserve(id),
    staleTime: 0,
  });
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading items…</p>;
  if (isError || !data) return <p className="text-xs text-status-error">Couldn’t load the items.</p>;
  const lines = data.line_items ?? [];
  const advance = (data.receipt_details ?? []).map((r) => `${r.mode_name ?? r.mode_code} ${formatAmount(r.amount)}`).join(' · ');
  return (
    <div className="flex flex-col gap-2">
      {lines.map((l) => (
        <div key={l.transaction_item_id ?? l.sku} className="flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{l.item_name}</p>
            <p className="text-xs text-muted-foreground">{l.sku} · {l.item_code}</p>
          </div>
          <span className="shrink-0 tabular-nums">{formatAmount(l.net_amount)}</span>
        </div>
      ))}
      {advance && <p className="text-xs text-muted-foreground">Advance: {advance}</p>}
    </div>
  );
}

function ReserveCard({ r, highlight, onCancel }) {
  const [open, setOpen] = useState(highlight);
  const status = STATUS[r.document_status] ?? STATUS[0];
  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${highlight ? 'border-accent' : 'border-border'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{r.document_no}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
          </div>
          <p className="mt-0.5 text-sm text-foreground">{r.party_name}{r.mobile ? ` · ${r.mobile}` : ''}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(r.document_date)} · {r.pieces ?? 0} pc{r.pieces === 1 ? '' : 's'}{r.employee_name ? ` · JC ${r.employee_name}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatAmount(r.net_amount)}</p>
          <p className="text-xs text-muted-foreground">Advance {formatAmount(r.receipt_amount ?? 0)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" className="gap-1 px-2" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          {open ? 'Hide items' : 'View items'}
        </Button>
        {r.document_status === 1 && (
          <Button size="sm" variant="outline" className="gap-1 text-status-error" onClick={() => onCancel(r)}>
            <XCircle size={14} aria-hidden="true" /> Cancel reserve
          </Button>
        )}
      </div>
      {open && <div className="mt-3 border-t border-border pt-3"><ReserveItems id={r.transaction_id} /></div>}
    </div>
  );
}

function ReservationsScreen() {
  const createdId = Number(useSearchParams().get('created')) || null;
  const companyId = useSelector(selectActiveStoreId);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [toCancel, setToCancel] = useState(null);

  const { data = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['reserves', 'list', companyId],
    queryFn: () => listReserves({ companyId }),
    enabled: !!companyId,
    staleTime: 0,
  });

  const cancel = useMutation({
    mutationFn: (r) => cancelReserve(r.transaction_id),
    onSuccess: (_d, r) => {
      toast.success(`${r.document_no} cancelled`);
      queryClient.invalidateQueries({ queryKey: ['reserves'] });
    },
    onError: (err) => toast.error(err?.serverMessage ?? err?.message ?? 'Couldn’t cancel the reserve'),
  });

  const q = search.trim().toLowerCase();
  const rows = data.filter((r) => (
    (filter === 'all' || (filter === 'active' ? r.document_status !== 2 : r.document_status === 2))
    && (!q || [r.document_no, r.party_name, r.mobile].some((v) => String(v ?? '').toLowerCase().includes(q)))
  ));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Stock held for customers. Reserve from checkout (cart with in-store pieces → Reserve).</p>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:w-80" role="radiogroup" aria-label="Status">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={filter === id}
              onClick={() => setFilter(id)}
              className={`rounded-md px-2 py-1.5 text-sm font-medium ${filter === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reserve no, customer or mobile" className="sm:flex-1" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" aria-label="Loading reserves" /></div>
      ) : isError ? (
        <p className="py-10 text-center text-sm text-status-error">Couldn’t load reserves. Try refreshing.</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Bookmark size={36} className="text-muted-foreground/50" aria-hidden="true" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">{data.length ? 'No reserves match your filters.' : 'No reserves at this store yet.'}</p>
          {!data.length && (
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link href="/catalog"><ShoppingBag size={16} aria-hidden="true" /> Browse Catalog</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <ReserveCard key={r.transaction_id} r={r} highlight={r.transaction_id === createdId} onCancel={setToCancel} />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!toCancel}
        onOpenChange={(o) => !o && setToCancel(null)}
        title={`Cancel ${toCancel?.document_no ?? 'reserve'}?`}
        description="This cancels the reserve in OrnaVerse. Settle any advance with the customer as you would in OrnaVerse."
        confirmLabel="Cancel reserve"
        cancelLabel="Keep"
        confirmVariant="destructive"
        onConfirm={() => { cancel.mutate(toCancel); setToCancel(null); }}
      />
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={null}>
      <ReservationsScreen />
    </Suspense>
  );
}
