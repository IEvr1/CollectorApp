import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { listAvailability } from "@/lib/booking";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

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

  const slots =
    service && body.date
      ? await listAvailability({
          staffId: selectedStaff.id,
          serviceDurationMin: service.durationMin,
          date: body.date,
        })
      : [];

  return NextResponse.json({
    salon: { id: salon.id, name: salon.name },
    services: salon.services,
    staff: salon.staff,
    slots,
  });
}
