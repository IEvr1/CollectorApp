import { NextResponse } from "next/server";
import { z } from "zod";
import { listAvailability } from "@/lib/booking";
import { getManageSessionPayload } from "@/lib/manage-from-request";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: Request) {
  const session = await getManageSessionPayload();
  if (!session?.bookingId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: session.bookingId, salonId: session.salonId },
    include: { customer: true, service: true },
  });

  if (!booking || booking.customer.phoneE164 !== session.phoneE164) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  if (booking.status !== "CONFIRMED" || booking.endsAt <= now) {
    return NextResponse.json({ error: "Booking not manageable" }, { status: 409 });
  }

  const salon = await prisma.salon.findFirst({ where: { id: session.salonId } });
  if (!salon) {
    return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  }

  const slots = await listAvailability({
    staffId: booking.staffId,
    serviceDurationMin: booking.service.durationMin,
    date: body.date,
    timeZone: salon.timezone,
    salonId: salon.id,
    excludeBookingId: booking.id,
  });

  return NextResponse.json({ slots });
}
