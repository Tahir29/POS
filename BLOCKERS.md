# Where we're stuck — OrnaVerse integration

As of **2026-08-01**, branch `repair-creditnote_01082026`.

All of these were established by capturing real traffic from OrnaVerse's own
ERP on UAT, or by reading real posted records — not by guessing payloads.

---

## 1. Refund never settles the credit — OrnaVerse's bug, not ours

**Status:** blocked on OrnaVerse. Our code is correct and complete.

A Refund creates cleanly (200, correct totals, correct linked credit), but
the credit it pays out stays fully outstanding.

**The proof it isn't us:** I created a refund through **OrnaVerse's own ERP**
(`HO-RFD-07-26-5`). It didn't settle either. After both that one and ours
(`HO-RFD-07-26-6`), Tahir Kutty's Credit in **their own POS** still reads the
full **₹2,10,443.00**, and every credit row still carries its full
`balance_amount`.

**A correction worth recording:** we previously concluded settlement was keyed
on `receipts[].ref_document_no` matching the refund's own `document_no`. That
was wrong. The three historical refunds that appeared "settled" reference
credits from another branch (`PN1`) or another financial year, which
`POSReceiptsSelect/List` filters out regardless. Our record now matches their
shape exactly and still settles nothing.

**What to ask OrnaVerse:** what marks a POS credit as settled, and why their
own Refund screen doesn't do it on this tenant.

---

## 2. Scheme close-out (Mature / Cancel) is unreachable

**Status:** blocked on OrnaVerse. No contract exists to build against.

Their enrollment screen has **Matured** and **Cancel** buttons, but neither
can be completed:

1. Both are gated on *"Calculate Maturity/Cancellation before proceeding!"*
2. That gate reads `benifit_amount` / `total_payable` on the enrollment form
3. The calculate call fires and returns, but the values are never written
   back — the enrollment is **read-only once any receipt exists**
   (*"Receipts are generated for this Enrollment, cannot edit"*)
4. Every enrollment worth maturing has receipts, so the gate can never pass

**Consequence: no close-out API call is ever emitted, so there is nothing to
capture and no payload to implement.** Deliberately not guessed — these are
financial state changes on real enrollments.

Also seen: `GetSchemeCancellation` returns *"An error occurred while
processing your request"* for a partly-paid enrollment in **their** UI, while
succeeding for a fully-paid one through ours. The scheme's own rule reads
*"Cancellation: Not Allowed"*, which may explain it.

**What to ask OrnaVerse:** how a paid-up enrollment is matured or cancelled
when the record is locked by its own receipts.

---

## 3. Credit Note appears non-functional in their ERP

**Status:** blocked on OrnaVerse for the payload; our known bugs are fixed.

Their Credit Note sold-item picker sends
`{ party_id, transaction_type: 4 }` to `POS/InvoiceItems/List`, which returns
**zero rows for every party tried, in both companies**. The same query with
`party_ids` (array) *does* return rows — so the filter combination is at
fault. That is why their CreditNote list is completely empty: none has ever
been created on this tenant.

**Fixed on our side regardless:**
- We were sending **Return's** `document_id` (55). Credit Note is its own
  type: **123**, prefix `CRN`, ledger 129, 60-day backdating.
- We posted unconditionally after Create, but 123 is `auto_posting: true`, so
  the follow-up returned `AlreadyPosted`.
- The success path never closed the form.

**Two constraints our UI does NOT yet enforce:**
- Credit Note is `is_tax_applicable`, so the party must have a
  `tax_reg_type`. Without one OrnaVerse rejects it, with no explanation
  surfaced to staff. (Enum: 1 Regular, 2 Composition, 3 Unregistered,
  **4 Consumer** ← retail default, 5 Overseas, 6 SEZ, 7 Deemed,
  8 Tax Deductor, 9 SEZ Developer, 10 Casual Taxable, 11 Non-resident.)
- Its items come from **transaction_type 4 (consignment sales)**, not the
  type 1 used by Return/Buyback/Exchange.

**Still unknown:** which `Set*Items` helper prices Credit Note lines. One
successful save in their ERP would name it.

---

## 4. Repair — their "Save Repair Order" silently does nothing

**Status:** blocked on OrnaVerse for the payload. Two real findings for us.

### 4a. We're modelling the wrong document at the counter

Their POS counter's **Repair (F5)** tab creates a **Repair Order**
(document 75) — the button literally reads *"Save Repair Order"* and the tab
badge reads "Order". Repair In (117) and Repair Out (118) are **workshop-side**
documents raised as the job moves through the workshop, not at the counter.

**Our Repair module builds a Repair In from the counter. That's the wrong
document for that journey.** The intake screen should create a Repair Order.

### 4b. Their Save button doesn't work

With a valid customer and a priced item, clicking **Save Repair Order** fires
the config calls (`Documents/GetDocumentById`, `DocumentNumbering/List`,
`ExchangeRate/GetExchangeRate`, `Company/Retrieve`,
`CompanyWiseLocations/List`) and then **no Create is ever sent** — no error,
no dialog, no console message. Confirmed nothing was created: Repair Order
count stayed at 62, Repair In count at 20.

So the Create payload still can't be captured.

### What we DID get — the pricing helper

Adding a sold item to a Repair Order calls **`Helpers/SetReturnItems`** — the
same helper Return uses:

```json
{ "selected_products": [ ...rows from POS/InvoiceItems/List... ],
  "is_labour_applicable": false, "is_tax_applicable": false,
  "document_id": 75, "exchange_rate": 1, "company_id": 1 }
```

That answers the "which Set*Items helper prices repair lines" question.

### Consistent with this: our own RepairIn/Create 500s

Tried twice — a ~24-field whitelist off the order line, and the full line
passed through intact. Both returned a generic 500. Given 4a, that may be
because we're posting the wrong document type for this journey entirely.

---

## Fixed this session (no longer blocked)

| Flow | What was wrong |
|---|---|
| **Scheme Record Payment** | `month_ids` was never sent — a receipt must declare which instalment it pays. Also wrongly built as a sales document. Verified live: ₹1,000 → ₹9,000, enrollment Completed. |
| **Scheme calculators** | Maturity/Foreclose/Cancellation take the **whole enrollment object**, not an id. All five earlier attempts sent an id, which is why they all 500'd. Verified live with real figures. |
| **Repair Out** | `auto_posting` is true, but we posted anyway — every Repair Out failed `AlreadyPosted`. |
| **Credit Note** | Wrong document type + double-post (above). |

---

## The technique that unlocked all of this

Arm a `fetch` + `XMLHttpRequest` interceptor in OrnaVerse's own ERP, filtered
to `/Services/`, persisting to `sessionStorage` so captures survive page
loads. Drive their UI, then diff their payload against ours.

Their Serenity pickers resist synthetic clicks — selection lives in an
internal SlickGrid model. Drive them through the widget API instead:

```js
jQuery(el).tryGetWidget(Serenity.Widget).set_value(id);
jQuery(el).triggerHandler('change');
```

Read-only queries against any of their services, using the page's own auth:

```js
Q.serviceCall({ url: Q.resolveServiceUrl('POS/RepairIn/List'),
                request: { Take: 5 }, onSuccess: console.log });
```
