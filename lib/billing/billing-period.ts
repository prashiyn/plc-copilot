export interface BillingPeriod {
  start: Date;
  end: Date;
  label: string;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calendarMonthPeriod(reference: Date, monthOffset: number): BillingPeriod {
  const anchor = new Date(reference.getFullYear(), reference.getMonth() - monthOffset, 1);
  const start = startOfDay(anchor);
  const end = endOfDay(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
  return {
    start,
    end,
    label: `${formatDate(start)} – ${formatDate(end)}`,
  };
}

function anchoredMonthPeriod(reference: Date, anchorDay: number, monthOffset: number): BillingPeriod {
  const ref = new Date(reference);
  ref.setMonth(ref.getMonth() - monthOffset);

  let startYear = ref.getFullYear();
  let startMonth = ref.getMonth();
  const lastDayOfMonth = new Date(startYear, startMonth + 1, 0).getDate();
  const day = Math.min(anchorDay, lastDayOfMonth);
  let start = startOfDay(new Date(startYear, startMonth, day));

  if (reference < start && monthOffset === 0) {
    start = startOfDay(addMonths(start, -1));
  }

  const nextStart = addMonths(start, 1);
  const end = endOfDay(new Date(nextStart.getTime() - 1));

  return {
    start,
    end,
    label: `${formatDate(start)} – ${formatDate(end)}`,
  };
}

/** Resolve a billing window. `monthOffset` 0 = current period, 1 = previous, etc. */
export function resolveBillingPeriod(
  subscriptionStartDate: Date | null | undefined,
  monthOffset = 0,
  referenceDate: Date = new Date(),
): BillingPeriod {
  if (!subscriptionStartDate) {
    return calendarMonthPeriod(referenceDate, monthOffset);
  }
  const anchorDay = subscriptionStartDate.getDate();
  return anchoredMonthPeriod(referenceDate, anchorDay, monthOffset);
}

export function nextBillingDate(period: BillingPeriod): Date {
  const next = new Date(period.end);
  next.setDate(next.getDate() + 1);
  return startOfDay(next);
}
