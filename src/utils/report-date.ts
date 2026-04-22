const REPORT_TIME_ZONE = "UTC";

function formatDateInTimeZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not format report date for ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function getPacificReportDate(input: string | Date = new Date()): string {
  const value = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`Invalid date input: ${String(input)}`);
  }

  return formatDateInTimeZone(value, REPORT_TIME_ZONE);
}

export { REPORT_TIME_ZONE };
