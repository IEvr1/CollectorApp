import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { listAvailability } from "@/lib/booking";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { ANY_AVAILABLE_STAFF_ID } from "@/lib/staff-selection";
import { todayIsoInTimeZone } from "@/lib/timezone";

const payloadSchema = z.object({
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
  date: z.string().optional(),
  lang: z.string().optional(),
});

export async function POST(request: Request) {
  await ensureSalonSeed();
  const body = payloadSchema.parse(await request.json());
  const lang = parseLocale(body.lang);
  const t =
    lang === "el"
      ? {
          noSalon: "Δεν υπάρχει ρυθμισμένο salon.",
        }
      : {
          noSalon: "No salon configured",
        };
  const salon = await prisma.salon.findFirst({
    include: { services: true, staff: true },
  });

  if (!salon) {
    return NextResponse.json({ error: t.noSalon }, { status: 500 });
  }

  const service = salon.services.find((item) => item.id === body.serviceId);
  const selectedStaff =
    salon.staff.find((member) => member.id === body.staffId) ?? salon.staff[0];
  const useAnyAvailableStaff = body.staffId === ANY_AVAILABLE_STAFF_ID;

  const minBookableDate = todayIsoInTimeZone(salon.timezone);

  const slots =
    service && body.date && selectedStaff
      ? useAnyAvailableStaff
        ? Array.from(
            new Set(
              (
                await Promise.all(
                  salon.staff.map((member) =>
                    listAvailability({
                      staffId: member.id,
                      serviceDurationMin: service.durationMin,
                      date: body.date!,
                      timeZone: salon.timezone,
                      salonId: salon.id,
                    }),
                  ),
                )
              ).flat(),
            ),
          ).sort()
        : await listAvailability({
            staffId: selectedStaff.id,
            serviceDurationMin: service.durationMin,
            date: body.date,
            timeZone: salon.timezone,
            salonId: salon.id,
          })
      : [];

  return NextResponse.json({
    salon: { id: salon.id, name: salon.name, timezone: salon.timezone },
    minBookableDate,
    services: salon.services,
    staff: salon.staff,
    slots,
  });
}
