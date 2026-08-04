# Where we're stuck — OrnaVerse integration

As of **2026-08-05**, branch `repair-creditnote_01082026`.

## 0. Checkout — SOLVED 2026-08-05 (was: every sale rejected)

Invoice/Create rejected every sale with *"Not enough stock of &lt;code&gt; can not
Save"*, for items that demonstrably had stock. Root-caused by capturing
OrnaVerse's own UAT Invoice counter end to end.

**We were billing the catalog PRODUCT; a sale consumes a physical PIECE.**
Their own UI makes the split explicit — the Estimation tab browses "Catalog",
the Invoice tab browses "Stock", listing one row per piece with its own SKU
and LINE#. The journey they actually run:

1. `Inventory/StockJournal/List` `{ item_id, company_id, has_sku: true }`
   → one row per piece, already carrying `item_line_no`, `sku`,
   `location_id`, `item_attribute_id` and a real `item_cost`.
2. `Helpers/SetSalesItems` `{ selected_products: [those rows], document_id: 54 }`
   → prices them; every identity field above passes through untouched.
3. `POS/Invoice/Create` → 200. The only field added after pricing is
   `sales_person_id` (verified by diffing their two payloads key by key).

Three fields we had been fabricating are now simply correct:
`item_line_no` (the stock line, e.g. 2844 — not a 1..n counter, which is what
failed the lookup), `sku` (the piece's stock SKU, not the item code), and
`item_cost` (its real cost — previously hardcoded 0).

**Also fixed, and independently serious:** the cart quoted the item master's
stale static `item_rate` while the invoice was raised at the live price.
ADJLR00826 showed ₹48,704.82 in the catalog and priced at ₹107,840.02 — the
stored rate omits ₹60,888 of diamond. The counter would have undercharged by
₹57,674, and OrnaVerse rejected the short-paid sale with *"No credit facility
is allowed for …"*. Checkout now prices the real pieces up front
(`useCheckoutPricing`) and collects against that figure.

Verified live: `HO-LJ-0826-003` and `HO-LJ-0826-004`, both posted, fully paid,
balance ₹0, correct stock line and cost on the line item.

### Still open for OrnaVerse

- **Silver925 prices to ₹0.** `SetSalesItems` returns a computed `item_rate`
  (e.g. 680.64) but `sub_total`/`net_amount`/`tax_amount` all 0 for every
  Silver925 item. **Their own POS does the same** — an estimate for
  LJ11253988 in their UI reads "Estimate Total ₹0.00" — so this is their data
  or rate config, not our payload. Gold prices correctly through the identical
  call. A sale of a silver item will post at zero value until they fix it.
- **`item_cost` still sent as 0 on Orders.** It arrives on stock rows for
  invoices, so invoices are correct; nothing exposes it for the catalog path.

---

Everything here was established by capturing real traffic from OrnaVerse's own
UAT app, reading real posted records, or reading their own client bundle —
not by guessing payloads.

## Summary

| # | Flow | Status |
|---|---|---|
| 1 | Refund settlement | **Blocked** — their own ERP refund fails too |
| 2 | Scheme close-out | **Blocked** — record locks; no API call is reachable |
| 3 | Credit Note | **Blocked** — their item picker returns nothing, for anyone |
| 4 | Repair | **Solved our side** — but their own Save sends no Create |

Items 1–3 need OrnaVerse to answer. Item 4 is working for us and is reported
because it's a defect in their product.

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

## 4. Repair — SOLVED on our side, still broken on theirs

**Status:** working for us. Worth reporting to them because **their own POS
cannot do it.**

### Their "Save Repair Order" sends nothing

With a valid customer and a priced item, clicking **Save Repair Order** fires
the config calls (`Documents/GetDocumentById`, `DocumentNumbering/List`,
`ExchangeRate/GetExchangeRate`, `Company/Retrieve`,
`CompanyWiseLocations/List`) and then **no Create is ever sent** — no error,
no dialog, no console message. The form even resets as if it saved.
Confirmed via their own service counts, unchanged before and after:
Repair Order 62, Repair In 20, Repair Out 13, Repair Invoice 4.

### The root cause on our side (fixed)

Our counter was building a **Repair In (117)**. It should build a **Repair
Order (75)** — their own button reads *"Save Repair Order"*, and Repair In /
Repair Out are **workshop-side** documents raised later as the job moves
through the workshop. That mismatch, not a payload shape, is why
`RepairIn/Create` kept returning a generic 500.

### How the contract was obtained without a capture

Their traffic never produced a Create to copy, so it came from two places:

1. **Their client bundle** — `/esm/_chunks/chunk-CJSQNCGC.js` defines
   `RepairForm`, `formKey: "Inventory.Repair"`, via `initFormType`: the full
   **49-field** contract, transcribed verbatim.
2. **Captured off their counter** — line items are priced by
   **`Helpers/SetReturnItems`**, the same helper Return uses:

```json
{ "selected_products": [ ...rows from POS/InvoiceItems/List... ],
  "is_labour_applicable": false, "is_tax_applicable": false,
  "document_id": 75, "exchange_rate": 1, "company_id": 1 }
```

Also from their source: `repair_type` 1 = stock item, 2 = customer's sold
item; and the repair sold-item filter is **`transaction_type: 3`** —
Return/Buyback/Exchange use 1, Credit Note uses 4.

### Verified live

`SetReturnItems` 200 → `Inventory/Repair/Create` **200 EntityId 130** →
`Post` 200. Repair Order count **62 → 63**, record reads
`HO-REP-08-26-1 | Tahir Kutty | 1pc 1.507g | Posted`.

**Our app creates a Repair Order that their own POS cannot.**

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
