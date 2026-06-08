// Money is stored as integer cents everywhere. Convert/format only at the edges.

export const toCents = (dollars) => Math.round(Number(dollars || 0) * 100);
export const fromCents = (cents) => Number(cents || 0) / 100;

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
});

/** Format integer cents as CAD currency, e.g. 530375 → "$5,303.75". */
export const formatCents = (cents) => CAD.format(fromCents(cents));

/** Compact signed cents, e.g. -4000 → "-$40.00". */
export const formatSignedCents = (cents) =>
  (cents < 0 ? "-" : "") + CAD.format(Math.abs(fromCents(cents)));
