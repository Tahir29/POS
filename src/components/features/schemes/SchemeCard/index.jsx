import { Calendar, IndianRupee, Clock, Gift, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Displays a single scheme's details.
 * Enum values (scheme_type, bonus_type, payout_type) are displayed
 * neutrally as raw values — no assumed labels.
 */
export default function SchemeCard({ scheme }) {
  const {
    // FIXED 2026-09-16, then CONFIRMED 2026-09-17 against a real live
    // Services/CRM/Schemes/List capture: this row (the scheme PRODUCT
    // master — what an operator picks to enroll a customer into, not an
    // enrollment instance) has NO name field beyond scheme_code at all —
    // no scheme_name, no scheme_display_name. scheme_code IS the scheme's
    // own human name here (e.g. "New year", "Vault of dream"), not a
    // machine code. scheme_display_name is a REAL field, but only on
    // SchemeEnrollment/List rows (confirmed live: a composite like
    // "HO-SEN-08-26-8 | Vault of dream") — a different row shape, read
    // correctly elsewhere (useSchemeEnrollments.js, useCustomerEnrollments.js).
    // This component was originally reading a bare scheme_name (silently
    // rendering "—" for every real scheme); reads scheme_code only now,
    // not a defensive fallback against a field this row can never carry.
    scheme_code,
    scheme_type,
    tenure,
    scheme_amount,
    max_installment_amount,
    grace_period,
    bonus_value,
    bonus_type,
    allow_cancellation,
    schemes_rules,
  } = scheme;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        {/* scheme_code IS the scheme's own name here (see destructuring
            comment above) — a separate muted "code" subtitle used to sit
            below this repeating the exact same value; dropped rather than
            showing the same string twice. */}
        <h3 className="text-base font-semibold text-foreground leading-tight">
          {scheme_code ?? '—'}
        </h3>
        {scheme_type != null && (
          <Badge variant="secondary" className="h-auto shrink-0 rounded-md px-2 py-1 text-xs">
            Type {scheme_type}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={<IndianRupee className="w-3.5 h-3.5" />}
          label="Monthly Amount"
          value={scheme_amount != null ? `₹${Number(scheme_amount).toLocaleString('en-IN')}` : '—'}
        />
        <Metric
          icon={<Calendar className="w-3.5 h-3.5" />}
          label="Tenure"
          value={tenure != null ? `${tenure} months` : '—'}
        />
        {max_installment_amount != null && (
          <Metric
            icon={<IndianRupee className="w-3.5 h-3.5" />}
            label="Max Instalment"
            value={`₹${Number(max_installment_amount).toLocaleString('en-IN')}`}
          />
        )}
        {grace_period != null && (
          <Metric
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Grace Period"
            value={`${grace_period} days`}
          />
        )}
        {bonus_value != null && (
          <Metric
            icon={<Gift className="w-3.5 h-3.5" />}
            label={bonus_type != null ? `Bonus (Type ${bonus_type})` : 'Bonus'}
            value={bonus_value}
          />
        )}
        {allow_cancellation != null && (
          <Metric
            icon={<Ban className="w-3.5 h-3.5" />}
            label="Cancellation"
            value={allow_cancellation ? 'Allowed' : 'Not Allowed'}
          />
        )}
      </div>

      {Array.isArray(schemes_rules) && schemes_rules.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Scheme Rules</p>
          <ul className="flex flex-col gap-1">
            {schemes_rules.map((rule, idx) => (
              <li
                key={rule.rule_id ?? idx}
                className="text-xs text-foreground bg-muted/50 rounded px-2.5 py-1.5"
              >
                {rule.rule_description ?? rule.rule_name ?? `Rule ${idx + 1}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}