// Customer demographic enums — CONFIRMED LIVE 2026-10-24 against OrnaVerse's
// own native Create Customer form (<select> option values read directly from
// the DOM). marital_status is 1=Married, 2=Unmarried — not 1=Single as an
// earlier guess had it in two separate copies of this list.

export const GENDER_OPTIONS = [
  { value: 1, label: 'Male' },
  { value: 2, label: 'Female' },
  { value: 3, label: 'Other' },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: 1, label: 'Married' },
  { value: 2, label: 'Unmarried' },
];

export const RELIGION_OPTIONS = [
  { value: 1, label: 'Christian' },
  { value: 2, label: 'Hindu' },
  { value: 3, label: 'Muslim' },
  { value: 4, label: 'Buddhist' },
  { value: 5, label: 'Sikh' },
  { value: 6, label: 'Jew' },
  { value: 7, label: 'Jain' },
];
