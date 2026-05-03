import twilio from "twilio";

export async function sendBookingSms(params: { phoneE164: string; body: string }) {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
  const alphaSenderId = process.env.TWILIO_ALPHA_SENDER_ID?.trim();
  /** Alphanumeric sender first; Twilio number as fallback if alpha is unset. */
  const from = alphaSenderId || phoneNumber;

  if (!sid || !token) {
    console.log("SMS (dev fallback):", params);
    return;
  }

  if (!messagingServiceSid && !from) {
    console.log("SMS (dev fallback, no TWILIO_PHONE_NUMBER / TWILIO_ALPHA_SENDER_ID / TWILIO_MESSAGING_SERVICE_SID):", params);
    return;
  }

  const client = twilio(sid, token);

  try {
    if (messagingServiceSid) {
      await client.messages.create({
        messagingServiceSid,
        to: params.phoneE164,
        body: params.body,
      });
      return;
    }

    await client.messages.create({
      to: params.phoneE164,
      from: from!,
      body: params.body,
    });
  } catch (error: unknown) {
    const raw =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: string }).message)
        : String(error);
    const codeRaw =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: number | string }).code
        : undefined;
    const code = codeRaw !== undefined ? Number(codeRaw) : NaN;
    console.error("Twilio SMS failed:", error);
    if (code === 21_212 || /21212|Invalid From/i.test(raw)) {
      throw new Error(
        "Twilio rejected the sender (error 21212). Alphanumeric TWILIO_ALPHA_SENDER_ID must be registered for your destination (e.g. Cyprus +357), or clear it to use TWILIO_PHONE_NUMBER / TWILIO_MESSAGING_SERVICE_SID.",
      );
    }
    throw error instanceof Error ? error : new Error(raw);
  }
}
