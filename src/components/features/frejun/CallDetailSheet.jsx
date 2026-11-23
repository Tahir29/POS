'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import PhoneLink from '@/components/shared/PhoneLink';
import CallAudioPlayer from './CallAudioPlayer';
import {
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  User,
  Shield,
  FileText,
  ExternalLink,
  Bot,
  Hash,
  Tag,
  Store,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import { identifyStoreForCall } from '@/lib/frejun/storeMapping';
import { formatDateTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

/**
 * Resolves calling agent name, store, and tag details from Frejun tags or email.
 */
export function resolveAgentInfo(call) {
  if (!call) {
    return { agentName: 'Unknown Agent', storeName: null, fullTag: null, tagId: null, store: null };
  }

  const store = call.store || identifyStoreForCall(call);

  // 1. Check if call has tags matching "Store - Agent Name"
  if (Array.isArray(call.tags)) {
    for (const tag of call.tags) {
      const tagName = tag.name?.trim() || '';
      if (tagName.includes('-')) {
        const [storePart, ...rest] = tagName.split('-');
        const agentPart = rest.join('-').trim();
        if (agentPart) {
          return {
            agentName: agentPart,
            storeName: store?.label || storePart.trim(),
            fullTag: tagName,
            tagId: tag.id,
            store,
          };
        }
      } else if (tagName && tagName.toLowerCase() !== store?.key?.toLowerCase()) {
        return {
          agentName: tagName,
          storeName: store?.label || null,
          fullTag: tagName,
          tagId: tag.id,
          store,
        };
      }
    }
  }

  // 2. If identified store, use store label
  if (store) {
    return {
      agentName: `${store.label} Agent`,
      storeName: store.label,
      fullTag: store.label,
      tagId: null,
      store,
    };
  }

  // 3. Fallback to recruiter username
  const email = call.recruiter?.trim() || '';
  let agentName = email;
  if (email.includes('@')) {
    const username = email.split('@')[0];
    agentName = username
      .split(/[._]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }

  return {
    agentName: agentName || 'Store Agent',
    storeName: null,
    fullTag: null,
    tagId: null,
    store: null,
  };
}

export function formatCallDuration(minutes) {
  if (minutes == null || isNaN(minutes) || minutes <= 0) return '0s';
  const totalSeconds = Math.round(Number(minutes) * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function CallStatusBadge({ status }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const s = String(status).toLowerCase();

  let tone = 'bg-muted text-muted-foreground border-border';
  if (s.includes('answer') || s.includes('complete')) {
    tone = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
  } else if (s.includes('not-answer') || s.includes('miss') || s.includes('fail') || s.includes('reject')) {
    tone = 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
  } else if (s.includes('ongoing') || s.includes('progress')) {
    tone = 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20 animate-pulse';
  } else if (s.includes('busy')) {
    tone = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
  }

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize', tone)}>
      {status}
    </span>
  );
}

export function CallTypeBadge({ type }) {
  const isIncoming = String(type).toLowerCase().includes('in');
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {isIncoming ? (
        <PhoneIncoming size={12} className="text-emerald-500" />
      ) : (
        <PhoneOutgoing size={12} className="text-primary" />
      )}
      <span className="capitalize">{type || 'Outgoing'}</span>
    </span>
  );
}

export function CallTagBadge({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span
          key={t.id || t.name}
          className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
        >
          <Tag size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate max-w-[170px]">{t.name?.trim()}</span>
        </span>
      ))}
    </div>
  );
}

export default function CallDetailSheet({ call, open, onOpenChange }) {
  if (!call) return null;

  const displayName = call.candidate_name?.trim() || (call.candidate_number ? `Lead (${call.candidate_number})` : 'Customer Lead');
  const agentInfo = resolveAgentInfo(call);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader className="space-y-1 text-left">
          <div className="flex items-center justify-between gap-2">
            <CallStatusBadge status={call.status} />
            <CallTypeBadge type={call.call_type} />
          </div>
          <SheetTitle className="text-xl font-heading font-bold text-foreground mt-2">
            {displayName}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Hash size={12} /> Call ID: <span className="font-mono">{call.call_id || call.id}</span>
          </SheetDescription>
          {Array.isArray(call.tags) && call.tags.length > 0 && (
            <div className="pt-1.5">
              <CallTagBadge tags={call.tags} />
            </div>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Audio recording player */}
          {call.recording_url ? (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Call Recording
              </h4>
              <CallAudioPlayer src={call.recording_url} />
            </div>
          ) : null}

          {/* Customer info */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User size={14} /> Customer Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Customer Name</span>
                <span className="font-medium text-foreground">
                  {call.candidate_name?.trim() || '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Phone</span>
                <PhoneLink
                  phone={call.candidate_number}
                  className="font-medium text-foreground hover:text-primary text-sm inline-flex items-center gap-1 mt-0.5 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Calling Agent & Store Tagging */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Shield size={14} /> Calling Agent & Store Tagging
            </h4>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Calling Agent:</span>
                <span className="font-semibold text-foreground text-sm">
                  {agentInfo.agentName}
                </span>
              </div>
              {agentInfo.storeName && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Store:</span>
                  <span className="font-medium text-foreground">
                    {agentInfo.storeName} Store
                  </span>
                </div>
              )}
              {Array.isArray(call.tags) && call.tags.length > 0 && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Store Tag:</span>
                  <CallTagBadge tags={call.tags} />
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                <span className="text-xs text-muted-foreground">Agent Email:</span>
                <span className="text-xs font-medium text-foreground font-mono break-all">
                  {call.recruiter || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Agent Phone:</span>
                <PhoneLink phone={call.creator_number} className="text-xs font-mono" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Virtual Number:</span>
                <span className="text-xs font-mono text-foreground">{call.virtual_number || '—'}</span>
              </div>
            </div>
          </div>

          {/* Call Reason & Outcome */}
          {(call.call_reason || call.call_outcome) && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HelpCircle size={14} /> Call Purpose & Disposition
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Call Reason</span>
                  <span className="font-medium text-foreground">
                    {call.call_reason || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Call Outcome</span>
                  <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground mt-0.5">
                    <CheckCircle size={11} className="text-primary" />
                    {call.call_outcome || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Call Timeline & Duration */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock size={14} /> Timeline & Duration
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Start Time</span>
                <span className="text-xs font-medium text-foreground">
                  {formatDateTime(call.call_start_time) || '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">End Time</span>
                <span className="text-xs font-medium text-foreground">
                  {formatDateTime(call.call_end_time) || '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Talk Duration</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCallDuration(call.call_duration)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Cost</span>
                <span className="text-xs text-foreground font-mono">
                  {call.cost != null ? `₹${call.cost}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {call.recruiter_notes ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText size={14} /> Notes
              </h4>
              <p className="text-sm text-foreground whitespace-pre-wrap">{call.recruiter_notes}</p>
            </div>
          ) : null}

          {/* AI Insights & Transcript */}
          {call.ai_insights || call.call_transcript ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Bot size={14} /> AI Insights & Transcript
              </h4>
              {call.ai_insights && (
                <p className="text-xs text-foreground leading-relaxed">{call.ai_insights}</p>
              )}
              {call.call_transcript && (
                <div className="mt-2 text-xs text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-card/80 p-2 border border-border font-mono">
                  {call.call_transcript}
                </div>
              )}
            </div>
          ) : null}

          {/* External Link */}
          {call.link ? (
            <div className="pt-2">
              <Button asChild variant="outline" className="w-full justify-center gap-2">
                <a href={call.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} />
                  Open in Frejun Portal
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
