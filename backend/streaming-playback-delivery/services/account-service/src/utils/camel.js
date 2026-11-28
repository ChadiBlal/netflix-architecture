const toCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const camelRows = (rows) =>
  rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [toCamel(k), v])));
module.exports = { camelRows };
