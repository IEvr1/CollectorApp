export function normalizePhone(raw: string) {
  const digitsOnly = raw.replace(/\D/g, "");

  // Cyprus mobile numbers only (for SMS): +3579XXXXXXX or local 9XXXXXXX.
  if (/^3579\d{7}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }

  if (/^9\d{7}$/.test(digitsOnly)) {
    return `+357${digitsOnly}`;
  }

  throw new Error("Only Cyprus mobile numbers are supported (e.g. +3579XXXXXXX).");
}
