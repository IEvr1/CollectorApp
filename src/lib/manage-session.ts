import jwt from "jsonwebtoken";
import { smsLinkSigningSecret } from "@/lib/deep-link-token";

export const MANAGE_SESSION_COOKIE = "salon_manage_session";

const SESSION_TTL = "30m";

export type ManageSessionPayload = {
  salonId: string;
  phoneE164: string;
  bookingId?: string;
};

type JwtBody = ManageSessionPayload & { typ?: string };

export function signManageSessionCookieValue(payload: ManageSessionPayload): string {
  return jwt.sign({ ...payload, typ: "manage" }, smsLinkSigningSecret(), {
    expiresIn: SESSION_TTL,
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
