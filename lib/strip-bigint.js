/**
 * Neon / pg can return int8 as bigint; JSON.stringify throws on bigint.
 */
export function stripBigInts(value) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map(stripBigInts);
  }
  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = stripBigInts(entry);
    }
    return out;
  }
  return value;
}
