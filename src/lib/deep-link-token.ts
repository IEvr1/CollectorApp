import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL_SECONDS = 60 * 30;

type TokenPayload = {
  salonId: string;
  phoneE164: string;
  bookingId?: string;
  jti: string;
};

function tokenSecret() {
  const secret = process.env.SMS_LINK_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      throw new Error("SMS_LINK_SECRET must be set in production");
    }
    return secret;
  }
  return secret ?? "dev-secret-change-me";
}

export async function createDeepLinkToken(payload: Omit<TokenPayload, "jti">) {
  const jti = crypto.randomUUID();
  const signed = jwt.sign({ ...payload, jti }, tokenSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
  const tokenHash = crypto.createHash("sha256").update(signed).digest("hex");

  await prisma.smsLinkToken.create({
    data: {
      salonId: payload.salonId,
      bookingId: payload.bookingId,
      phoneE164: payload.phoneE164,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000),
    },
  });

  return signed;
}

export async function verifyDeepLinkToken(token: string) {
  const decoded = jwt.verify(token, tokenSecret()) as TokenPayload;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const record = await prisma.smsLinkToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
  });

  if (!record) {
    throw new Error("Token invalid or expired");
  }

  await prisma.smsLinkToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return decoded;
}
