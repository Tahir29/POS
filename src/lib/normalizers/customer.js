// src/lib/normalizers/customer.js
// Shared normalizers for OrnaVerse customer (party) records.
// Field names confirmed against a real Services/POS/Customer/List
// response (party_address uses address/address_1/city/state/country/pin_code,
// "is_default" flag, address_type 4=billing-ish / 5=shipping-ish — not
// strictly confirmed, default address picked via is_default first,
// falling back to party_address[0]).

/**
 * Normalizes an OrnaVerse address record (party_address entry) into the
 * shape used for order.shipping_address / order.billing_address and
 * cart.customerAddress.
 */
export function normalizeAddress(addr) {
  if (!addr) return null;
  const get = (key) => (addr[key] && addr[key] !== 'NA' ? addr[key] : '');
  return {
    address:  get('address') || get('address_1') || '',
    address1: addr.address && addr.address_1 ? get('address_1') : '',
    city:     get('city'),
    state:    get('state'),
    country:  get('country'),
    zip:      get('pin_code') || '',
  };
}

/**
 * Picks the address to use for a customer: the default-flagged address if
 * one exists, otherwise the first address on file, otherwise null.
 */
function pickAddress(partyAddress) {
  if (!Array.isArray(partyAddress) || partyAddress.length === 0) return null;
  const defaultAddr = partyAddress.find((a) => a.is_default);
  return defaultAddr ?? partyAddress[0];
}

/**
 * Normalizes an OrnaVerse customer (party) record into the shape used by
 * cart.attachCustomer (customerId/customerName/customerMobile/customerAddress)
 * plus the full record (raw) for display components.
 */
export function normalizeCustomer(entity) {
  if (!entity) return null;

  const pickedAddress = pickAddress(entity.party_address);
  const customerAddress = pickedAddress
    ? normalizeAddress(pickedAddress)
    : normalizeAddress({
        address:  entity.address,
        city:     entity.city_name,
        state:    entity.state_name,
        country:  entity.country_name,
        pin_code: entity.pin_code,
      });

  return {
    customerId:      entity.party_id,
    customerName:    entity.party_name,
    customerMobile:  entity.mobile,
    customerEmail:   entity.email && entity.email !== 'NA' ? entity.email : null,
    customerPan:     entity.pan && entity.pan !== 'NA' ? entity.pan : null,
    customerAddress,
    raw: entity,
  };
}