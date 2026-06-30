export default function formatPeriod(period: string, withDate = false) {
  const [year, month, date] = period.split("-");

  const monthName = new Date(2000, Number(month) - 1).toLocaleString("id-ID", {month: "long"});

  return withDate
    ? `${Number(date)} ${monthName}, ${year}`
    : `${monthName}, ${year}`;
}