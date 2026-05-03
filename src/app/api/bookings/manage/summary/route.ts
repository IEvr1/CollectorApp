import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getManageSessionPayload } from "@/lib/manage-from-request";

export async function GET() {
  const session = await getManageSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const salon = await prisma.salon.findFirst({ where: { id: session.salonId } });
  if (!salon) {
    return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  }

  if (!session.bookingId) {
    const customer = await prisma.customer.findUnique({
      where: {
        salonId_phoneE164: { salonId: session.salonId, phoneE164: session.phoneE164 },
      },
    });
    return NextResponse.json({
      salonName: salon.name,
      salonTimezone: salon.timezone,
      customerName: customer?.name ?? null,
      customerPhone: session.phoneE164,
      booking: null,
      uiPhase: "no_booking" as const,
      canManage: false,
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

  const now = new Date();
  const canManage =
    booking.status === "CONFIRMED" && booking.endsAt > now;

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

  return NextResponse.json({
    salonName: salon.name,
    salonTimezone: salon.timezone,
    customerName: booking.customer.name,
    customerPhone: booking.customer.phoneE164,
    booking: {
      id: booking.id,
      startsAt: booking.startsAt.toISOString(),
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
  });
}
