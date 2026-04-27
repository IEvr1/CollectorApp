import { google } from "googleapis";

type BusyRange = {
  start: Date;
  end: Date;
};

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
}) {
  if (!params.calendarId) {
    return [] as BusyRange[];
  }

  const calendar = getGoogleCalendarClient();
  if (!calendar) {
    return [] as BusyRange[];
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
    return busy
      .filter((item) => item.start && item.end)
      .map((item) => ({
        start: new Date(item.start as string),
        end: new Date(item.end as string),
      }));
  } catch (error) {
    console.error("Google Calendar freebusy failed", error);
    return [] as BusyRange[];
  }
}

export async function createGoogleCalendarEvent(params: {
  calendarId?: string | null;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
}) {
  if (!params.calendarId) {
    return null;
  }

  const calendar = getGoogleCalendarClient();
  if (!calendar) {
    return null;
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

    return response.data.id ?? null;
  } catch (error) {
    console.error("Google Calendar event insert failed", error);
    return null;
  }
}
