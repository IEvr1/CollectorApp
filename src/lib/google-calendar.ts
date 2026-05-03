import { google } from "googleapis";

export type BusyRange = {
  start: Date;
  end: Date;
};

/** When ok is false, callers must fail closed (do not treat as empty availability). */
export type FreeBusyResult =
  | { ok: true; busy: BusyRange[] }
  | { ok: false; busy: BusyRange[]; reason: string };

export type CalendarEventResult =
  | { ok: true; eventId: string | null }
  | { ok: false; eventId: null; reason: string };

function getGoogleCalendarClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

export async function listGoogleBusyRanges(params: {
  calendarId?: string | null;
  timeMin: Date;
  timeMax: Date;
}): Promise<FreeBusyResult> {
  if (!params.calendarId) {
    return { ok: true, busy: [] };
  }

  const calendar = getGoogleCalendarClient();
  if (!calendar) {
    return {
      ok: false,
      busy: [],
      reason: "Google Calendar is not configured but staff has a calendar ID",
    };
  }

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: params.timeMin.toISOString(),
        timeMax: params.timeMax.toISOString(),
        items: [{ id: params.calendarId }],
      },
    });

    const busy = response.data.calendars?.[params.calendarId]?.busy ?? [];
    const ranges = busy
      .filter((item) => item.start && item.end)
      .map((item) => ({
        start: new Date(item.start as string),
        end: new Date(item.end as string),
      }));
    return { ok: true, busy: ranges };
  } catch (error) {
    console.error("Google Calendar freebusy failed", error);
    return { ok: false, busy: [], reason: "Google Calendar freebusy request failed" };
  }
}

export async function createGoogleCalendarEvent(params: {
  calendarId?: string | null;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
}): Promise<CalendarEventResult> {
  if (!params.calendarId) {
    return { ok: true, eventId: null };
  }

  const calendar = getGoogleCalendarClient();
  if (!calendar) {
    return {
      ok: false,
      eventId: null,
      reason: "Google Calendar is not configured but staff has a calendar ID",
    };
  }

  try {
    const response = await calendar.events.insert({
      calendarId: params.calendarId,
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: { dateTime: params.start.toISOString() },
        end: { dateTime: params.end.toISOString() },
      },
    });

    return { ok: true, eventId: response.data.id ?? null };
  } catch (error) {
    console.error("Google Calendar event insert failed", error);
    return { ok: false, eventId: null, reason: "Google Calendar event insert failed" };
  }
}
