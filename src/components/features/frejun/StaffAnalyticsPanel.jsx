'use client';

import { useMemo, useState } from 'react';
import {
  Users,
  PhoneCall,
  PhoneCheck,
  Clock,
  Percent,
  Search,
  Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function StaffAnalyticsPanel({
  analytics = [],
  isLoading = false,
  onSelectStaff,
}) {
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    let totalCalls = 0;
    let totalAnswered = 0;
    let totalMinutes = 0;

    for (const row of analytics) {
      totalCalls += Number(row.total_calls) || 0;
      totalAnswered += Number(row.answered_calls) || 0;
      totalMinutes += parseFloat(row.total_minutes) || 0;
    }

    const answerRate = totalCalls > 0 ? ((totalAnswered / totalCalls) * 100).toFixed(1) : 0;
    return {
      activeStaff: analytics.length,
      totalCalls,
      totalAnswered,
      totalMinutes: Math.round(totalMinutes),
      answerRate,
    };
  }, [analytics]);

  const filtered = useMemo(() => {
    if (!search.trim()) return analytics;
    const q = search.toLowerCase();
    return analytics.filter((r) => r.user?.toLowerCase().includes(q));
  }, [analytics, search]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users size={14} className="text-primary" /> Active Staff
          </span>
          <span className="text-2xl font-bold font-heading text-foreground">
            {stats.activeStaff}
          </span>
          <span className="text-[11px] text-muted-foreground">Team members with calls</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <PhoneCall size={14} className="text-sky-500" /> Total Calls
          </span>
          <span className="text-2xl font-bold font-heading text-foreground">
            {stats.totalCalls.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-muted-foreground">Across selected period</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Percent size={14} className="text-emerald-500" /> Answer Rate
          </span>
          <span className="text-2xl font-bold font-heading text-foreground text-emerald-600 dark:text-emerald-400">
            {stats.answerRate}%
          </span>
          <span className="text-[11px] text-muted-foreground">
            {stats.totalAnswered.toLocaleString('en-IN')} answered calls
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock size={14} className="text-amber-500" /> Talk Time
          </span>
          <span className="text-2xl font-bold font-heading text-foreground">
            {stats.totalMinutes.toLocaleString('en-IN')} <span className="text-sm font-normal text-muted-foreground">mins</span>
          </span>
          <span className="text-[11px] text-muted-foreground">Total calling duration</span>
        </div>
      </div>

      {/* Staff Breakdown Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div>
            <h3 className="font-heading font-semibold text-foreground text-base">
              Staff Performance Overview
            </h3>
            <p className="text-xs text-muted-foreground">
              Call activity and connection rates per representative
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff email…"
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No staff records found for the selected dates.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3 text-right">Total Calls</th>
                  <th className="px-4 py-3 text-right">Answered</th>
                  <th className="px-4 py-3 text-right">Unanswered</th>
                  <th className="px-4 py-3 text-right">Answer Rate</th>
                  <th className="px-4 py-3 text-right">Talk Time</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((staff) => {
                  const total = Number(staff.total_calls) || 0;
                  const answered = Number(staff.answered_calls) || 0;
                  const missed = Math.max(0, total - answered);
                  const rate = total > 0 ? ((answered / total) * 100).toFixed(1) : '0';
                  const minutes = parseFloat(staff.total_minutes) || 0;

                  return (
                    <tr key={staff.user} className="hover:bg-accent/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex flex-col">
                          <span className="break-all">{staff.user}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                        {total.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                        {answered.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-rose-500">
                        {missed.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium font-mono tabular-nums',
                          parseFloat(rate) >= 40
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : parseFloat(rate) >= 20
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        )}>
                          {rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                        {minutes.toFixed(1)} mins
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => onSelectStaff?.(staff.user)}
                        >
                          <Filter size={12} className="mr-1" />
                          View Calls
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
