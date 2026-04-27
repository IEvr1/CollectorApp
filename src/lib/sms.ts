import twilio from "twilio";

export async function sendBookingSms(params: { phoneE164: string; body: string }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const alphaSenderId = process.env.TWILIO_ALPHA_SENDER_ID;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const from = alphaSenderId ?? phoneNumber;

  if (!sid || !token || !from) {
    console.log("SMS (dev fallback):", params);
    return;
  }

  const client = twilio(sid, token);
  await client.messages.create({
    to: params.phoneE164,
    from,
    body: params.body,
  });
}
