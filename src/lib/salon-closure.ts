import { prisma } from "@/lib/prisma";

/** `isoDate` and closure rows are salon-local calendar YYYY-MM-DD strings (lexicographic compare is valid). */
export async function isSalonClosedOnLocalDate(
  salonId: string,
  isoDate: string,
): Promise<boolean> {
  const row = await prisma.salonClosure.findFirst({
    where: {
      salonId,
      startDate: { lte: isoDate },
      endDate: { gte: isoDate },
    },
    select: { id: true },
  });
  return Boolean(row);
}
