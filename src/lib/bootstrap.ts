import { prisma } from "@/lib/prisma";

export async function ensureSalonSeed() {
  const salonCount = await prisma.salon.count();
  if (salonCount > 0) {
    return;
  }

  const salon = await prisma.salon.create({
    data: {
      name: "Glow Beauty Salon",
      timezone: "Europe/Nicosia",
      services: {
        create: [
          { name: "Hair Cut", durationMin: 45 },
          { name: "Hair Color", durationMin: 90 },
          { name: "Nail Care", durationMin: 60 },
          { name: "Facial", durationMin: 50 },
        ],
      },
      staff: {
        create: [{ name: "Aisha" }, { name: "Mona" }, { name: "Sara" }],
      },
    },
    include: { staff: true },
  });

  for (const member of salon.staff) {
    await prisma.staffAvailability.createMany({
      data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
        staffId: member.id,
        weekday,
        startHour: 10,
        endHour: 20,
      })),
    });
  }
}
