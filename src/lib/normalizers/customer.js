// src/lib/normalizers/customer.js
// Shared normalizers for OrnaVerse customer (party) records.
//
// CONFIRMED FIELD NAMES (v1.json schemas):
//
// POS.CustomerRow (top-level):
//   party_id, party_name, mobile, email, pan_no (NOT pan)
//   address, address_1, pin_code (int32)
//   city_id, state_id, country_id  (numeric IDs)
//   city_name, state_name, country_name  (display strings)
//   birth_date, anniversary  (datetime strings)
//   gender, marital_status
//   party_address[]  → PartyAddressRow[]
//
// Master.PartyAddressRow (inside party_address[]):
//   address_id, party_id, address_type
//   address, address_1
//   city_id, state_id, country_id  (numeric IDs)
//   city, state, country            (display strings — NOT city_name)
//   pin_code  (string — different type from CustomerRow)
//   is_default

// ─── ADDRESS NORMALIZER ───────────────────────────────────────────────────────

/**
 * Normalises an address record into the flat shape used by:
 *   cart.customerAddress
 *   order.shipping_address / billing_address payloads
 *
 * Handles BOTH sources:
 *   PartyAddressRow  → city/state/country (string fields)
 *   CustomerRow root → city_name/state_name/country_name
 *
 * @param {object|null} addr
 * @returns {{
 *   address:  string,
 *   address1: string,
 *   city:     string,
 *   state:    string,
 *   country:  string,
 *   zip:      string,
 *   city_id:    number|null,
 *   state_id:   number|null,
 *   country_id: number|null,
 * }|null}
 */
export function normalizeAddress(addr) {
  if (!addr) return null;

  const str = (key) => {
    const v = addr[key];
    return v && v !== 'NA' ? String(v) : '';
  };

  return {
    // Text lines
    address:  str('address') || str('address_1'),
    address1: addr.address && addr.address_1 ? str('address_1') : '',

    // City — PartyAddressRow uses city, CustomerRow root uses city_name
    city:    str('city')    || str('city_name'),
    state:   str('state')   || str('state_name'),
    country: str('country') || str('country_name'),

    // Postal code — string on PartyAddressRow, int32 on CustomerRow
    zip: str('pin_code'),

    // Numeric IDs — needed when building update payloads
    city_id:    addr.city_id    ?? null,
    state_id:   addr.state_id   ?? null,
    country_id: addr.country_id ?? null,
  };
}

// ─── ADDRESS PICKER ───────────────────────────────────────────────────────────

/**
 * Picks the best address from a customer's party_address[]:
 *   1. The entry flagged is_default: true
 *   2. Otherwise the first entry in the array
 *   3. Otherwise null
 *
 * @param {Array|null|undefined} partyAddress
 * @returns {object|null}
 */
function pickAddress(partyAddress) {
  if (!Array.isArray(partyAddress) || partyAddress.length === 0) return null;
  return partyAddress.find((a) => a.is_default) ?? partyAddress[0];
}

// ─── CUSTOMER NORMALIZER ──────────────────────────────────────────────────────

/**
 * Normalises a POS.CustomerRow into the shape used throughout the app:
 *   - cart.attachCustomer()   needs: customerId, customerName, customerMobile, customerAddress
 *   - CustomerDetailSheet     needs: all display fields
 *   - useUpdateCustomer hook  reads from normalised.raw to build the update payload
 *
 * @param {object|null} entity — raw POS.CustomerRow from API
 * @returns {{
 *   customerId:      number,
 *   customerName:    string,
 *   customerMobile:  string,
 *   customerEmail:   string|null,
 *   customerPan:     string|null,
 *   birthDate:       string|null,
 *   anniversary:     string|null,
 *   gender:          number|null,
 *   maritalStatus:   number|null,
 *   customerAddress: object|null,
 *   raw:             object,
 * }|null}
 */
export function normalizeCustomer(entity) {
  if (!entity) return null;

  // Address — prefer a partyAddress entry; fall back to root CustomerRow fields
  const pickedAddress = pickAddress(entity.party_address);
  const customerAddress = pickedAddress
    ? normalizeAddress(pickedAddress)
    : normalizeAddress({
        address:    entity.address,
        address_1:  entity.address_1,
        city_name:  entity.city_name,
        state_name: entity.state_name,
        country_name: entity.country_name,
        city_id:    entity.city_id,
        state_id:   entity.state_id,
        country_id: entity.country_id,
        pin_code:   entity.pin_code,
      });

  return {
    customerId:     entity.party_id,
    customerName:   entity.party_name,
    customerMobile: entity.mobile,

    // Nullable fields — treat "NA" and empty strings as null
    customerEmail:  entity.email  && entity.email  !== 'NA' ? entity.email  : null,
    customerPan:    entity.pan_no && entity.pan_no !== 'NA' ? entity.pan_no : null, // pan_no not pan

    // Personal details — needed by CustomerDetailSheet and Edit form
    birthDate:    entity.birth_date   ?? null,
    anniversary:  entity.anniversary  ?? null,
    gender:       entity.gender       ?? null,
    maritalStatus:entity.marital_status ?? null,

    customerAddress,

    // Full raw entity preserved — used by useUpdateCustomer to build payload
    raw: entity,
  };
}

// ─── CREATE PAYLOAD BUILDER ───────────────────────────────────────────────────

/**
 * Builds the Entity payload for POS/Customer/Create.
 * Maps form values (from NewCustomerForm / customerSchema) to CustomerRow fields.
 *
 * @param {{
 *   party_name:   string,
 *   mobile:       string,
 *   email?:       string,
 *   pan_no?:      string,
 *   address?:     string,
 *   address_1?:   string,
 *   city_id?:     number,
 *   state_id?:    number,
 *   country_id?:  number,
 *   pin_code?:    string,
 *   birth_date?:  string,
 *   anniversary?: string,
 *   gender?:      number,
 *   marital_status?: number,
 *   company_id:   number,
 * }} formValues
 * @returns {object} CustomerRow entity ready for { Entity: ... } payload
 */
export function buildCustomerCreatePayload(formValues) {
  return {
    party_name:      formValues.party_name,
    mobile:          formValues.mobile,
    email:           formValues.email          || undefined,
    pan_no:          formValues.pan_no         || undefined,
    address:         formValues.address        || undefined,
    address_1:       formValues.address_1      || undefined,
    city_id:         formValues.city_id        ?? undefined,
    state_id:        formValues.state_id       ?? undefined,
    country_id:      formValues.country_id     ?? undefined,
    pin_code:        formValues.pin_code       || undefined,
    birth_date:      formValues.birth_date     || undefined,
    anniversary:     formValues.anniversary    || undefined,
    gender:          formValues.gender         ?? undefined,
    marital_status:  formValues.marital_status ?? undefined,
    company_id:      formValues.company_id,
  };
}

// ─── UPDATE PAYLOAD BUILDER ───────────────────────────────────────────────────

/**
 * Builds the Entity payload for POS/Customer/Update.
 * Merges the original raw CustomerRow with form changes.
 * OrnaVerse requires the full record — partial updates are not supported.
 *
 * IMPORTANT: Always call retrieveCustomer() first to get the latest raw record,
 * then pass it here as `originalRaw`. Never use stale data from the list response.
 *
 * @param {object} originalRaw    — raw POS.CustomerRow from Customer/Retrieve
 * @param {object} formChanges    — only the fields the user changed
 * @returns {object} Merged CustomerRow entity ready for { EntityId, Entity: ... } payload
 */
export function buildCustomerUpdatePayload(originalRaw, formChanges) {
  return {
    // Spread the full original record first (preserves all fields OrnaVerse requires)
    ...originalRaw,
    // Then overlay only what changed
    ...formChanges,
    // party_id must always be present (read-only in OrnaVerse but required in payload)
    party_id: originalRaw.party_id,
  };
}