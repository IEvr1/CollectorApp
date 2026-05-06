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

function resolveCalendarId(calendarId?: string | null) {
  const staffCalendar = calendarId?.trim();
  if (staffCalendar) {
    return staffCalendar;
  }
  const fallbackCalendar = process.env.GOOGLE_DEFAULT_CALENDAR_ID?.trim();
  return fallbackCalendar || null;
}

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
  const calendarId = resolveCalendarId(params.calendarId);
  if (!calendarId) {
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
        items: [{ id: calendarId }],
      },
    });

    const busy = response.data.calendars?.[calendarId]?.busy ?? [];
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
  const calendarId = resolveCalendarId(params.calendarId);
  if (!calendarId) {
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
      calendarId,
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

export type CalendarMutationResult = { ok: true } | { ok: false; reason: string };

export async function deleteGoogleCalendarEvent(params: {
  calendarId?: string | null;
  eventId?: string | null;
}): Promise<CalendarMutationResult> {
  const calendarId = resolveCalendarId(params.calendarId);
  if (!calendarId || !params.eventId) {
    return { ok: true };
  }

  const calendar = getGoogleCalendarClient();
  if (!calendar) {
    return { ok: false, reason: "Google Calendar is not configured" };
  }

  try {
    await calendar.events.delete({
      calendarId,
      eventId: params.eventId,
    });
    return { ok: true };
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: number }).code
        : undefined;
    if (code === 404) {
      return { ok: true };
    }
    console.error("Google Calendar event delete failed", error);
    return { ok: false, reason: "Google Calendar event delete failed" };
  }
}

export async function patchGoogleCalendarEvent(params: {
  calendarId?: string | null;
  eventId?: string | null;
  summary?: string;
  description?: string;
  start: Date;
  end: Date;
}): Promise<CalendarMutationResult> {
  const calendarId = resolveCalendarId(params.calendarId);
  if (!calendarId || !params.eventId) {
    return { ok: true };
  }

  const calendar = getGoogleCalendarClient();
  if (!calendar) {
    return { ok: false, reason: "Google Calendar is not configured" };
  }

  try {
    await calendar.events.patch({
      calendarId,
      eventId: params.eventId,
      requestBody: {
        ...(params.summary !== undefined ? { summary: params.summary } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
        start: { dateTime: params.start.toISOString() },
        end: { dateTime: params.end.toISOString() },
      },
    });
    return { ok: true };
  } catch (error) {
    console.error("Google Calendar event patch failed", error);
    return { ok: false, reason: "Google Calendar event patch failed" };
  }
}

