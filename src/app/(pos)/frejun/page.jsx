'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  PhoneCall,
  RefreshCw,
  Search,
  X,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Headphones,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Store,
  CheckCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import PhoneLink from '@/components/shared/PhoneLink';
import { useFrejunCalls } from '@/hooks/frejun/useFrejunCalls';
import { useFrejunAnalytics } from '@/hooks/frejun/useFrejunAnalytics';
import CallDetailSheet, {
  CallStatusBadge,
  CallTypeBadge,
  CallTagBadge,
  resolveAgentInfo,
  formatCallDuration,
} from '@/components/features/frejun/CallDetailSheet';
import CallAudioPlayer from '@/components/features/frejun/CallAudioPlayer';
import StaffAnalyticsPanel from '@/components/features/frejun/StaffAnalyticsPanel';
import { selectActiveStoreName, selectActiveStoreCode } from '@/store/slices/storeSlice';
import { matchStoreByNameOrCode } from '@/lib/frejun/storeMapping';
import { todayDateString, formatDateTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

const ALL = 'all';

// Predefined Store options matching Frejun configuration
const STORE_TAG_OPTIONS = [
  { value: ALL, label: 'All Stores & Staff' },
  { value: 'borivali', label: 'Borivali Store', email: 'lcmbombor@lucirajewelry.com' },
  { value: 'chembur', label: 'Chembur Store', email: 'lcsbomchb@lucirajewelry.com' },
  { value: 'pune', label: 'Pune Store', email: 'lcspnqjmr@lucirajewelry.com' },
  { value: 'lajpat', label: 'Lajpat Nagar Store', email: 'lcsdelljn@lucirajewelry.com' },
  { value: 'paschim', label: 'Paschim Vihar Store', email: 'lcsdelpvh@lucirajewelry.com' },
  { value: 'noida', label: 'Noida Store', email: 'lcnois18@lucirajewelry.com' },
  { value: 'malleshwaram', label: 'Malleshwaram Store', email: 'lcsblrmal@lucirajewelry.com' },
  { value: 'kondapur', label: 'Hyderabad Kondapur', email: 'ljhydkdp@lucirajewelry.com' },
  { value: 'somajiguda', label: 'Hyderabad Somajiguda', email: 'ljhydsmj@lucirajewelry.com' },
  { value: 'hsr', label: 'Bangalore HSR', email: 'ljblrhsr@lucirajewelry.com' },
  { value: 'jayanagar', label: 'Bangalore Jayanagar', email: 'ljblrjyn@lucirajewelry.com' },
];

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function calculatePresetDates(presetKey) {
  const today = todayDateString();
  const d = new Date();
  switch (presetKey) {
    case 'today':
      return [today, today];
    case 'yesterday':
      d.setDate(d.getDate() - 1);
      return [isoDay(d), isoDay(d)];
    case '7days':
      d.setDate(d.getDate() - 7);
      return [isoDay(d), today];
    case 'thisMonth':
      return [`${today.slice(0, 8)}01`, today];
    case '30days':
      d.setDate(d.getDate() - 30);
      return [isoDay(d), today];
    case 'all':
      d.setDate(d.getDate() - 90);
      return [isoDay(d), today];
    default:
      return [today, today];
  }
}

export default function FrejunTelephonyPage() {
  const activeStoreName = useSelector(selectActiveStoreName);
  const activeStoreCode = useSelector(selectActiveStoreCode);

  const matchedActiveStore = useMemo(() => {
    return matchStoreByNameOrCode(activeStoreName || activeStoreCode);
  }, [activeStoreName, activeStoreCode]);

  // Active Tab
  const [activeTab, setActiveTab] = useState('calls');

  // Proper Date Range Filter State
  const [datePreset, setDatePreset] = useState('today');
  const [fromDate, setFromDate] = useState(() => todayDateString());
  const [toDate, setToDate] = useState(() => todayDateString());

  // Store Filter: default to active logged-in store if matched, otherwise ALL
  const [selectedStoreTag, setSelectedStoreTag] = useState(() => {
    const initialMatched = matchStoreByNameOrCode(activeStoreName || activeStoreCode);
    return initialMatched ? initialMatched.key : ALL;
  });

  const userHasPickedStoreRef = useRef(false);

  useEffect(() => {
    if (!userHasPickedStoreRef.current && matchedActiveStore) {
      setSelectedStoreTag(matchedActiveStore.key);
    }
  }, [matchedActiveStore]);

  // General Filters
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(ALL);
  const [callType, setCallType] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Selected Call for Detail Sheet
  const [selectedCall, setSelectedCall] = useState(null);

  // Derive resolved userEmail and store query
  const resolvedFilter = useMemo(() => {
    const storeOption = STORE_TAG_OPTIONS.find((s) => s.value === selectedStoreTag);
    let email = '';
    let tag = '';
    let storeKey = '';

    if (storeOption && storeOption.value !== ALL) {
      if (storeOption.email) email = storeOption.email;
      storeKey = storeOption.value;
    }

    if (selectedAgent !== ALL) {
      if (selectedAgent.includes('@')) {
        email = selectedAgent;
      } else {
        tag = selectedAgent;
      }
    }

    return { email, tag, storeKey };
  }, [selectedStoreTag, selectedAgent]);

  const selectedStoreOption = useMemo(() => {
    return STORE_TAG_OPTIONS.find((s) => s.value === selectedStoreTag);
  }, [selectedStoreTag]);

  // Fetch Calls via React Query
  const {
    calls,
    count,
    totalPages,
    hasNext,
    hasPrevious,
    isLoading: isCallsLoading,
    isFetching: isCallsFetching,
    refetch: refetchCalls,
  } = useFrejunCalls({
    page,
    pageSize,
    search,
    userEmail: resolvedFilter.email,
    store: resolvedFilter.storeKey,
    tag: resolvedFilter.tag,
    dateStart: fromDate,
    dateEnd: toDate,
  });

  // Fetch Analytics via React Query
  const {
    analytics,
    isLoading: isAnalyticsLoading,
    isFetching: isAnalyticsFetching,
    refetch: refetchAnalytics,
  } = useFrejunAnalytics({
    dateStart: fromDate || calculatePresetDates('thisMonth')[0],
    dateEnd: toDate || todayDateString(),
    users: resolvedFilter.email,
  });

  // Client-side filtering for call_type & status & agent
  const displayedCalls = useMemo(() => {
    return calls.filter((c) => {
      if (callType !== ALL) {
        const type = String(c.call_type || '').toLowerCase();
        if (callType === 'incoming' && !type.includes('in')) return false;
        if (callType === 'outgoing' && !type.includes('out')) return false;
      }
      if (statusFilter !== ALL) {
        const s = String(c.status || '').toLowerCase();
        if (statusFilter === 'answered' && !(s.includes('answer') || s.includes('complete'))) return false;
        if (statusFilter === 'missed' && !(s.includes('not-answer') || s.includes('miss') || s.includes('fail') || s.includes('reject'))) return false;
        if (statusFilter === 'ongoing' && !s.includes('ongoing')) return false;
      }
      if (selectedAgent !== ALL) {
        const agentInfo = resolveAgentInfo(c);
        const matchName = agentInfo.agentName?.toLowerCase().includes(selectedAgent.toLowerCase());
        const matchTag = agentInfo.fullTag?.toLowerCase().includes(selectedAgent.toLowerCase());
        const matchEmail = c.recruiter?.toLowerCase() === selectedAgent.toLowerCase();
        if (!matchName && !matchTag && !matchEmail) return false;
      }
      return true;
    });
  }, [calls, callType, statusFilter, selectedAgent]);

  // Unique agent names and tags across calls for the Agent filter dropdown
  const agentOptions = useMemo(() => {
    const map = new Map();

    // From current calls
    for (const call of calls) {
      const info = resolveAgentInfo(call);
      if (info.agentName && !info.agentName.includes('Unknown') && !info.agentName.includes('Store Agent')) {
        const key = info.fullTag || info.agentName;
        const label = info.storeName ? `${info.agentName} (${info.storeName})` : info.agentName;
        map.set(key, label);
      }
    }

    // Known Borivali store agents
    map.set('Brandon Parkhe', 'Brandon Parkhe (Borivali)');
    map.set('Sarika Adangale', 'Sarika Adangale (Borivali)');
    map.set('Mamta Tambe', 'Mamta Tambe (Borivali)');
    map.set('Sanjay Jaiswal', 'Sanjay Jaiswal (Borivali)');

    // From analytics
    for (const item of analytics) {
      if (item.user && !map.has(item.user)) {
        map.set(item.user, item.user);
      }
    }

    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [calls, analytics]);

  // Overall quick statistics
  const summaryStats = useMemo(() => {
    let answered = 0;
    let missed = 0;
    let durationMins = 0;

    for (const c of displayedCalls) {
      const s = String(c.status || '').toLowerCase();
      if (s.includes('answer') || s.includes('complete')) answered++;
      else missed++;

      durationMins += Number(c.call_duration) || 0;
    }

    return {
      total: displayedCalls.length,
      serverCount: count,
      answered,
      missed,
      durationMins: Math.round(durationMins * 10) / 10,
    };
  }, [displayedCalls, count]);

  const handlePresetSelect = (presetKey) => {
    setDatePreset(presetKey);
    const [from, to] = calculatePresetDates(presetKey);
    setFromDate(from);
    setToDate(to);
    setPage(1);
  };

  const handleCustomDateChange = (from, to) => {
    setDatePreset('custom');
    setFromDate(from);
    setToDate(to);
    setPage(1);
  };

  const handleStoreSelect = (val) => {
    userHasPickedStoreRef.current = true;
    setSelectedStoreTag(val);
    setPage(1);
  };

  const handleRefresh = () => {
    refetchCalls();
    refetchAnalytics();
  };

  const handleSelectStaff = (email) => {
    setSelectedAgent(email);
    setActiveTab('calls');
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Headphones size={20} aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Frejun Calls & Telephony
              </h1>
              <p className="text-xs text-muted-foreground">
                Real-time call logs, tagged store interactions, and staff analytics from Frejun.
                {activeStoreName && (
                  <span className="ml-1.5 font-medium text-foreground">({activeStoreName})</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isCallsFetching || isAnalyticsFetching}
            className="h-9 gap-1.5 text-xs shadow-sm"
          >
            <RefreshCw
              size={14}
              className={cn(isCallsFetching || isAnalyticsFetching ? 'animate-spin text-primary' : '')}
            />
            <span>Refresh</span>
          </Button>

          <Button asChild size="sm" variant="default" className="h-9 gap-1.5 text-xs shadow-sm">
            <a href="https://product.frejun.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} />
              Frejun Portal
            </a>
          </Button>
        </div>
      </div>

      {/* Proper Date Range & Store Selection Bar */}
      <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 sm:gap-4">
        {/* Store Selection Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Store size={15} className="text-amber-500 shrink-0" />
            <span>Store:</span>
          </div>

          <Select value={selectedStoreTag} onValueChange={handleStoreSelect}>
            <SelectTrigger className="h-9 text-xs w-56 sm:w-64 bg-background font-medium">
              <SelectValue placeholder="Select Store" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {STORE_TAG_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Quick Switch Button if not on ALL */}
          {selectedStoreTag !== ALL && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStoreSelect(ALL)}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground border-dashed"
            >
              Show All Stores
            </Button>
          )}

          {/* Quick Switch to My Store if on ALL but user is assigned to a store */}
          {selectedStoreTag === ALL && matchedActiveStore && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStoreSelect(matchedActiveStore.key)}
              className="h-9 px-2.5 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
            >
              My Store ({matchedActiveStore.label.replace(' Store', '')})
            </Button>
          )}
        </div>

        {/* Date Range & Preset Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Calendar size={15} className="text-primary shrink-0" />
            <span>Date:</span>
          </div>

          {/* Preset Selector First */}
          <Select value={datePreset} onValueChange={handlePresetSelect}>
            <SelectTrigger className="h-9 text-xs w-32 bg-background font-medium">
              <SelectValue placeholder="Preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="all">Last 90 Days</SelectItem>
              {datePreset === 'custom' && <SelectItem value="custom">Custom Range</SelectItem>}
            </SelectContent>
          </Select>

          {/* Date Pickers Container */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-lg border border-border">
            <input
              type="date"
              value={fromDate}
              max={todayDateString()}
              onChange={(e) => handleCustomDateChange(e.target.value, toDate)}
              className="h-8 w-32 rounded-md border-0 bg-background px-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="From date"
            />
            <span className="text-xs text-muted-foreground font-medium px-0.5">to</span>
            <input
              type="date"
              value={toDate}
              max={todayDateString()}
              onChange={(e) => handleCustomDateChange(fromDate, e.target.value)}
              className="h-8 w-32 rounded-md border-0 bg-background px-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="To date"
            />
          </div>
        </div>
      </div>

      {/* Top Quick KPI Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <PhoneCall size={14} className="text-primary" /> Total Calls
          </span>
          <span className="text-2xl font-bold font-heading text-foreground">
            {count.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {selectedStoreOption?.value !== ALL
              ? `${selectedStoreOption.label}`
              : 'All stores in date range'}
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-500" /> Answered Calls
          </span>
          <span className="text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400">
            {summaryStats.answered}
          </span>
          <span className="text-[11px] text-muted-foreground">
            On this page view
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <XCircle size={14} className="text-rose-500" /> Unanswered / Missed
          </span>
          <span className="text-2xl font-bold font-heading text-rose-600 dark:text-rose-400">
            {summaryStats.missed}
          </span>
          <span className="text-[11px] text-muted-foreground">
            No connection established
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock size={14} className="text-amber-500" /> Talk Duration
          </span>
          <span className="text-2xl font-bold font-heading text-foreground">
            {summaryStats.durationMins} <span className="text-sm font-normal text-muted-foreground">mins</span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            Total active conversation
          </span>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="calls" className="gap-2 text-xs">
              <PhoneCall size={14} />
              Call Logs
              {count > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                  {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 text-xs">
              <Users size={14} />
              Staff Analytics
              {analytics.length > 0 && (
                <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-semibold text-secondary-foreground">
                  {analytics.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Call Logs Tab */}
        <TabsContent value="calls" className="space-y-4 outline-none">
          {/* Filters Toolbar */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Search Customer or Staff */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Customer mobile, name, or staff…"
                  className="pl-8 pr-8 h-9 text-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Agent Filter */}
              <Select
                value={selectedAgent}
                onValueChange={(val) => {
                  setSelectedAgent(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="All Calling Agents" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={ALL}>All Calling Agents</SelectItem>
                  {agentOptions.map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Call Direction Filter */}
              <Select
                value={callType}
                onValueChange={(val) => setCallType(val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="All Directions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Directions</SelectItem>
                  <SelectItem value="outgoing">Outgoing Calls</SelectItem>
                  <SelectItem value="incoming">Incoming Calls</SelectItem>
                </SelectContent>
              </Select>

              {/* Call Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Statuses</SelectItem>
                  <SelectItem value="answered">Answered / Completed</SelectItem>
                  <SelectItem value="missed">Not Answered / Missed</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Filters Summary & Reset */}
            {(search || selectedAgent !== ALL || callType !== ALL || statusFilter !== ALL || selectedStoreTag !== ALL) && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/50 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground text-[11px]">Filtered by:</span>
                  {selectedStoreOption && selectedStoreOption.value !== ALL && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                      <Store size={10} />
                      {selectedStoreOption.label}
                    </span>
                  )}
                  {selectedAgent !== ALL && (
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Agent: {selectedAgent}
                    </span>
                  )}
                  {callType !== ALL && (
                    <span className="inline-flex items-center gap-1 rounded bg-secondary border border-border px-2 py-0.5 text-[11px] font-medium text-secondary-foreground capitalize">
                      {callType}
                    </span>
                  )}
                  {statusFilter !== ALL && (
                    <span className="inline-flex items-center gap-1 rounded bg-secondary border border-border px-2 py-0.5 text-[11px] font-medium text-secondary-foreground capitalize">
                      {statusFilter}
                    </span>
                  )}
                  {search && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-mono">
                      &quot;{search}&quot;
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearch('');
                    setSelectedAgent(ALL);
                    setSelectedStoreTag(ALL);
                    setCallType(ALL);
                    setStatusFilter(ALL);
                    handlePresetSelect('today');
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X size={12} className="mr-1" />
                  Reset all filters
                </Button>
              </div>
            )}
          </div>

          {/* Calls Data Table */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {isCallsLoading ? (
              <div className="p-4 divide-y divide-border">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : displayedCalls.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Headphones size={32} className="mx-auto text-muted-foreground/60" />
                <h3 className="font-heading font-medium text-foreground text-base">No calls found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  No call logs match the selected store, calling agent, date range, or filters.
                </p>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefresh}
                    className="text-xs gap-1.5"
                  >
                    <RefreshCw size={13} />
                    Refresh Call List
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Customer / Lead</th>
                      <th className="px-4 py-3">Store & Calling Agent</th>
                      <th className="px-4 py-3">Purpose & Outcome</th>
                      <th className="px-4 py-3">Direction</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Time & Date</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Recording</th>
                      <th className="px-4 py-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedCalls.map((call) => {
                      const customerName = call.candidate_name?.trim();
                      const isNamed = Boolean(customerName);
                      const agentInfo = resolveAgentInfo(call);

                      return (
                        <tr
                          key={call.id || call.call_id}
                          onClick={() => setSelectedCall(call)}
                          className="hover:bg-accent/40 cursor-pointer transition-colors"
                        >
                          {/* Customer Column */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className={cn('text-sm font-semibold', isNamed ? 'text-foreground' : 'text-foreground/80')}>
                                {isNamed ? customerName : `Lead (${call.candidate_number || '—'})`}
                              </span>
                              <PhoneLink
                                phone={call.candidate_number}
                                className="text-xs text-muted-foreground hover:text-primary font-mono mt-0.5"
                              />
                            </div>
                          </td>

                          {/* Calling Agent & Store Tag Column */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 max-w-[220px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {agentInfo.storeName ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                                    <Store size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                    {agentInfo.storeName}
                                  </span>
                                ) : null}
                                <span className="font-semibold text-foreground text-xs">
                                  {agentInfo.agentName}
                                </span>
                              </div>
                              {Array.isArray(call.tags) && call.tags.length > 0 ? (
                                <CallTagBadge tags={call.tags} />
                              ) : (
                                <span className="text-[11px] text-muted-foreground font-mono truncate">
                                  {call.recruiter || '—'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Purpose & Outcome Column */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              {call.call_reason ? (
                                <span className="text-xs font-medium text-foreground">
                                  {call.call_reason}
                                </span>
                              ) : null}
                              {call.call_outcome ? (
                                <span className="inline-flex w-fit items-center gap-1 rounded bg-secondary px-1.5 py-0.2 text-[10px] font-medium text-secondary-foreground">
                                  <CheckCircle size={10} className="text-primary" />
                                  {call.call_outcome}
                                </span>
                              ) : null}
                              {!call.call_reason && !call.call_outcome && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <CallTypeBadge type={call.call_type} />
                          </td>

                          <td className="px-4 py-3">
                            <CallStatusBadge status={call.status} />
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                            {formatDateTime(call.call_start_time) || '—'}
                          </td>

                          <td className="px-4 py-3 font-mono tabular-nums text-xs font-medium text-foreground">
                            {formatCallDuration(call.call_duration)}
                          </td>

                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <CallAudioPlayer src={call.recording_url} compact={true} />
                          </td>

                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCall(call);
                              }}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              aria-label="View call details"
                            >
                              <ChevronRight size={16} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20">
              <div className="text-xs text-muted-foreground">
                Showing{' '}
                <span className="font-medium text-foreground">
                  {displayedCalls.length === 0 ? 0 : (page - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium text-foreground">
                  {Math.min(page * pageSize, count)}
                </span>{' '}
                of <span className="font-medium text-foreground">{count.toLocaleString('en-IN')}</span> calls
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!hasPrevious || page <= 1 || isCallsLoading}
                    className="h-8 px-2.5 text-xs gap-1"
                  >
                    <ChevronLeft size={14} />
                    <span>Prev</span>
                  </Button>

                  <span className="text-xs text-muted-foreground px-2">
                    Page <span className="font-medium text-foreground">{page}</span> of{' '}
                    <span className="font-medium text-foreground">{totalPages}</span>
                  </span>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasNext || page >= totalPages || isCallsLoading}
                    className="h-8 px-2.5 text-xs gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Staff Analytics Tab */}
        <TabsContent value="analytics" className="outline-none">
          <StaffAnalyticsPanel
            analytics={analytics}
            isLoading={isAnalyticsLoading}
            onSelectStaff={handleSelectStaff}
          />
        </TabsContent>
      </Tabs>

      {/* Call Detail Sheet */}
      <CallDetailSheet
        call={selectedCall}
        open={Boolean(selectedCall)}
        onOpenChange={(open) => !open && setSelectedCall(null)}
      />
    </div>
  );
}
