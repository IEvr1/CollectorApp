import { NextResponse } from "next/server";
import type { Booking, Customer, Service, Staff } from "@prisma/client";
import { getManageSessionPayload } from "@/lib/manage-from-request";
import { prisma } from "@/lib/prisma";
import { parseLocale } from "@/lib/locale";
import { formatSalonDateTimeDisplay, localeTagForLang } from "@/lib/timezone";

type BookingWithRelations = Booking & {
  customer: Customer;
  service: Service;
  staff: Staff;
};

function phaseForBooking(
  booking: Booking,
  now: Date,
): { uiPhase: "manageable" | "past" | "cancelled" | "completed"; canManage: boolean } {
  const canManage = booking.status === "CONFIRMED" && booking.endsAt > now;
  let uiPhase: "manageable" | "past" | "cancelled" | "completed";
  if (booking.status === "CANCELLED") {
    uiPhase = "cancelled";
  } else if (booking.status === "COMPLETED") {
    uiPhase = "completed";
  } else if (booking.status === "CONFIRMED" && booking.endsAt <= now) {
    uiPhase = "past";
  } else {
    uiPhase = "manageable";
  }
  return { uiPhase, canManage };
}

function serializeBookingSummary(
  booking: BookingWithRelations,
  now: Date,
  salonTimezone: string,
  locale: string,
) {
  const { uiPhase, canManage } = phaseForBooking(booking, now);
  return {
    id: booking.id,
    startsAt: booking.startsAt.toISOString(),
    startsAtDisplay: formatSalonDateTimeDisplay(booking.startsAt, salonTimezone, locale),
    endsAt: booking.endsAt.toISOString(),
    status: booking.status,
    service: {
      id: booking.service.id,
      name: booking.service.name,
      durationMin: booking.service.durationMin,
    },
    staff: { id: booking.staff.id, name: booking.staff.name },
    uiPhase,
    canManage,
  };
}

async function loadUpcomingConfirmed(customerId: string, salonId: string, now: Date) {
  return prisma.booking.findMany({
    where: {
      customerId,
      salonId,
      status: "CONFIRMED",
      endsAt: { gt: now },
    },
    include: { customer: true, service: true, staff: true },
    orderBy: { startsAt: "asc" },
  });
}

export async function GET(request: Request) {
  const lang = parseLocale(new URL(request.url).searchParams.get("lang"));
  const intlLocale = localeTagForLang(lang);

  const session = await getManageSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const salon = await prisma.salon.findFirst({ where: { id: session.salonId } });
  if (!salon) {
    return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  }

  const now = new Date();

  if (!session.bookingId) {
    const customer = await prisma.customer.findUnique({
      where: {
        salonId_phoneE164: { salonId: session.salonId, phoneE164: session.phoneE164 },
      },
    });
    const upcomingRows = customer
      ? await loadUpcomingConfirmed(customer.id, session.salonId, now)
      : [];
    const upcomingBookings = upcomingRows.map((b) =>
      serializeBookingSummary(b, now, salon.timezone, intlLocale),
    );
    return NextResponse.json({
      salonName: salon.name,
      salonTimezone: salon.timezone,
      customerName: customer?.name ?? null,
      customerPhone: session.phoneE164,
      booking: null,
      uiPhase: "no_booking" as const,
      canManage: false,
      upcomingBookings,
    });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: session.bookingId, salonId: session.salonId },
    include: { customer: true, service: true, staff: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.customer.phoneE164 !== session.phoneE164) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { uiPhase, canManage } = phaseForBooking(booking, now);

  const upcomingRows = await loadUpcomingConfirmed(booking.customerId, session.salonId, now);
  const upcomingBookings = upcomingRows.map((b) =>
    serializeBookingSummary(b, now, salon.timezone, intlLocale),
  );

  return NextResponse.json({
    salonName: salon.name,
    salonTimezone: salon.timezone,
    customerName: booking.customer.name,
    customerPhone: booking.customer.phoneE164,
    booking: {
      id: booking.id,
      startsAt: booking.startsAt.toISOString(),
      startsAtDisplay: formatSalonDateTimeDisplay(booking.startsAt, salon.timezone, intlLocale),
      endsAt: booking.endsAt.toISOString(),
      status: booking.status,
      service: {
        id: booking.service.id,
        name: booking.service.name,
        durationMin: booking.service.durationMin,
      },
      staff: { id: booking.staff.id, name: booking.staff.name },
    },
    uiPhase,
    canManage,
    upcomingBookings,
  });
}
