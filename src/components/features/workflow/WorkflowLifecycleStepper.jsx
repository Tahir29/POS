// src/components/features/workflow/WorkflowLifecycleStepper.jsx
import React, { useState } from 'react';
import { Check, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { WORKFLOW_STAGES, getStageMeta } from '@/lib/workflow/workflowConstants';
import { cn } from '@/lib/utils';

export default function WorkflowLifecycleStepper({ order, className, initialExpanded = false }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [selectedStageKey, setSelectedStageKey] = useState(null);

  if (!order) return null;

  const currentMeta = getStageMeta(order.current_step);
  const currentStepNumber = currentMeta?.stepNumber || 1;
  const isCancelled = order.status === 'cancelled' || order.status === 'rejected';

  const stagesData = order.stages || {};

  // Find data object for a given stage
  function getStageData(stage) {
    if (stagesData[stage.stageKey]) return stagesData[stage.stageKey];
    if (stagesData[stage.key]) return stagesData[stage.key];
    if (stage.alternateKeys) {
      for (const alt of stage.alternateKeys) {
        if (stagesData[alt]) return stagesData[alt];
      }
    }
    // Search by prefix
    const foundKey = Object.keys(stagesData).find(
      (k) => k.endsWith(`_${stage.key}`) || k === stage.key
    );
    return foundKey ? stagesData[foundKey] : null;
  }

  const activeStage = selectedStageKey
    ? WORKFLOW_STAGES.find((s) => s.key === selectedStageKey)
    : currentMeta;
  const activeStageData = activeStage ? getStageData(activeStage) : null;

  return (
    <div className={cn('bg-card border border-border rounded-xl p-4 flex flex-col gap-3 shadow-xs', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            11-Stage Manufacturing Lifecycle
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs font-medium text-foreground">
            Stage {currentStepNumber} of 11: <strong className="text-primary">{currentMeta.label}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          {expanded ? 'Hide Stage Inspector' : 'Inspect Stages'}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Stepper Bar */}
      <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex items-center justify-between min-w-[760px] relative px-2">
          {/* Connecting Background Line */}
          <div className="absolute left-6 right-6 top-3.5 h-0.5 bg-border -z-0" />

          {WORKFLOW_STAGES.map((stage) => {
            const stepNum = stage.stepNumber;
            const isPast = stepNum < currentStepNumber && !isCancelled;
            const isCurrent = stepNum === currentStepNumber;
            const isSelected = selectedStageKey === stage.key;

            let circleStyle = 'bg-muted border-border text-muted-foreground';
            if (isPast) {
              circleStyle = 'bg-emerald-600 border-emerald-600 text-white';
            } else if (isCurrent) {
              if (isCancelled) {
                circleStyle = 'bg-destructive border-destructive text-destructive-foreground animate-pulse';
              } else {
                circleStyle = 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse';
              }
            }

            return (
              <div
                key={stage.key}
                onClick={() => {
                  setSelectedStageKey(stage.key);
                  setExpanded(true);
                }}
                className="flex flex-col items-center cursor-pointer group relative z-10"
              >
                <div
                  className={cn(
                    'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all shadow-xs',
                    circleStyle,
                    isSelected && 'scale-110 ring-2 ring-primary ring-offset-2'
                  )}
                  title={`${stage.stepNumber}. ${stage.label}: ${stage.description}`}
                >
                  {isPast ? (
                    <Check size={14} strokeWidth={3} />
                  ) : isCurrent && isCancelled ? (
                    <AlertCircle size={14} />
                  ) : isCurrent ? (
                    <Clock size={13} />
                  ) : (
                    <span>{stepNum}</span>
                  )}
                </div>

                <span
                  className={cn(
                    'text-[10px] mt-1.5 text-center max-w-[65px] font-medium leading-tight transition-colors',
                    isCurrent
                      ? 'text-primary font-bold'
                      : isPast
                      ? 'text-foreground'
                      : 'text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  {stage.shortLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Stage Inspector Drawer / Details */}
      {expanded && activeStage && (
        <div className="mt-2 p-3 bg-muted/40 rounded-lg border border-border/60 text-xs flex flex-col gap-2 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                Step {activeStage.stepNumber}: {activeStage.label}
              </span>
              <span className="text-muted-foreground text-[11px]">({activeStage.description})</span>
            </div>
            {activeStageData?.status && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-background border border-border">
                Status: {activeStageData.status}
              </span>
            )}
          </div>

          {activeStageData ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1 text-muted-foreground">
              {Object.entries(activeStageData).map(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                  return (
                    <div key={key} className="col-span-2 sm:col-span-3 bg-background/50 p-2 rounded border border-border/40">
                      <span className="font-medium text-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                      <pre className="text-[11px] mt-1 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
                    </div>
                  );
                }
                return (
                  <div key={key} className="flex flex-col">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/80">
                      {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                    </span>
                    <span className="font-medium text-foreground truncate" title={String(value)}>
                      {String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground italic py-1">
              No detailed records captured yet for this stage. Stage is pending upstream progression.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
