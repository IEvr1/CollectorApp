import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(rawArgs) {
  const entries = rawArgs
    .map((value) => value.trim())
    .filter(Boolean)
    .map((pair) => pair.split("="))
    .filter((parts) => parts.length === 2)
    .map(([staffName, calendarId]) => ({
      staffName: staffName.trim(),
      calendarId: calendarId.trim(),
    }))
    .filter((item) => item.staffName && item.calendarId);

  return entries;
}

async function main() {
  const mappings = parseArgs(process.argv.slice(2));

  if (mappings.length === 0) {
    console.log('Usage: npm run set:staff-calendars -- "Aisha=calendar1@group.calendar.google.com" "Mona=calendar2@group.calendar.google.com"');
    process.exitCode = 1;
    return;
  }

  for (const mapping of mappings) {
    const staff = await prisma.staff.findFirst({
      where: { name: mapping.staffName },
      select: { id: true, name: true },
    });

    if (!staff) {
      console.warn(`Staff not found: ${mapping.staffName}`);
      continue;
    }

    await prisma.staff.update({
      where: { id: staff.id },
      data: { calendarId: mapping.calendarId },
    });

    console.log(`Updated ${staff.name} -> ${mapping.calendarId}`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to update staff calendars", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
