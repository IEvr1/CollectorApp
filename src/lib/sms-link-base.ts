function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getSmsLinkBaseUrl(): string {
  const smsBase = process.env.SMS_LINK_BASE_URL?.trim();
  if (smsBase) {
    return normalizeBaseUrl(smsBase);
  }

  const appBase = process.env.APP_BASE_URL?.trim();
  if (appBase) {
    return normalizeBaseUrl(appBase);
  }

  return "http://localhost:3000";
}
