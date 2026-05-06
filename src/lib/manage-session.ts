import jwt from "jsonwebtoken";
import { smsLinkSigningSecret } from "@/lib/deep-link-token";

export const MANAGE_SESSION_COOKIE = "salon_manage_session";

const DEFAULT_SESSION_TTL_SECONDS = 30 * 60;

export type ManageSessionPayload = {
  salonId: string;
  phoneE164: string;
  bookingId?: string;
};

type JwtBody = ManageSessionPayload & { typ?: string };

export function signManageSessionCookieValue(
  payload: ManageSessionPayload,
  expiresInSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
): string {
  const sec = Math.max(60, Math.min(expiresInSeconds, 7 * 24 * 60 * 60));
  return jwt.sign({ ...payload, typ: "manage" }, smsLinkSigningSecret(), {
    expiresIn: sec,
  });
}

export function parseManageSessionCookieValue(token: string): ManageSessionPayload | null {
  try {
    const decoded = jwt.verify(token, smsLinkSigningSecret()) as JwtBody;
    if (decoded.typ !== "manage") {
      return null;
    }
    return {
      salonId: decoded.salonId,
      phoneE164: decoded.phoneE164,
      bookingId: decoded.bookingId,
    };
  } catch {
    return null;
  }
}
