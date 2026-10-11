/**
 * U.S. federal holidays and business-day arithmetic.
 *
 * The holidays are the eleven set by 5 U.S.C. 6103(a), a public-domain U.S.
 * statute. When a holiday falls on a Saturday it is observed the Friday
 * before; on a Sunday, the Monday after (5 U.S.C. 6103(b) and Executive Order
 * 11582, as applied by the Office of Personnel Management). So New Year's Day
 * on a Saturday is observed on December 31 of the year before.
 *
 * Pure arithmetic: no network, no clock except where a caller asks for
 * "today", no storage. Dates are calendar dates (YYYY-MM-DD), handled in UTC
 * so a server's time zone can never shift a day.
 */

export const FIRST_YEAR = 2021; // Juneteenth became a federal holiday on June 17, 2021.
export const LAST_YEAR = 2100;

export const SOURCE = '5 U.S.C. 6103 (https://www.law.cornell.edu/uscode/text/5/6103); observance rules as applied by the U.S. Office of Personnel Management (https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/).';

export const SCOPE_NOTE =
  'These are U.S. federal holidays, the days federal offices close. States, banks, schools and private employers can observe other days: the Federal Reserve, for example, stays open on the Friday before a Saturday holiday, and Inauguration Day (January 20 after a presidential election) is a holiday only for federal workers in the Washington, D.C. area.';

type Rule =
  | { kind: 'fixed'; month: number; day: number }
  | { kind: 'nth'; month: number; weekday: number; n: number }
  | { kind: 'last'; month: number; weekday: number };

export type HolidayDef = { id: string; name: string; rule: Rule; ruleText: string };

const MON = 1;
const THU = 4;

export const HOLIDAYS: HolidayDef[] = [
  { id: 'new_years_day', name: "New Year's Day", rule: { kind: 'fixed', month: 1, day: 1 }, ruleText: 'January 1' },
  { id: 'mlk_day', name: 'Birthday of Martin Luther King, Jr.', rule: { kind: 'nth', month: 1, weekday: MON, n: 3 }, ruleText: 'Third Monday in January' },
  { id: 'washingtons_birthday', name: "Washington's Birthday", rule: { kind: 'nth', month: 2, weekday: MON, n: 3 }, ruleText: 'Third Monday in February' },
  { id: 'memorial_day', name: 'Memorial Day', rule: { kind: 'last', month: 5, weekday: MON }, ruleText: 'Last Monday in May' },
  { id: 'juneteenth', name: 'Juneteenth National Independence Day', rule: { kind: 'fixed', month: 6, day: 19 }, ruleText: 'June 19' },
  { id: 'independence_day', name: 'Independence Day', rule: { kind: 'fixed', month: 7, day: 4 }, ruleText: 'July 4' },
  { id: 'labor_day', name: 'Labor Day', rule: { kind: 'nth', month: 9, weekday: MON, n: 1 }, ruleText: 'First Monday in September' },
  { id: 'columbus_day', name: 'Columbus Day', rule: { kind: 'nth', month: 10, weekday: MON, n: 2 }, ruleText: 'Second Monday in October' },
  { id: 'veterans_day', name: 'Veterans Day', rule: { kind: 'fixed', month: 11, day: 11 }, ruleText: 'November 11' },
  { id: 'thanksgiving_day', name: 'Thanksgiving Day', rule: { kind: 'nth', month: 11, weekday: THU, n: 4 }, ruleText: 'Fourth Thursday in November' },
  { id: 'christmas_day', name: 'Christmas Day', rule: { kind: 'fixed', month: 12, day: 25 }, ruleText: 'December 25' },
];

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const DAY_MS = 86_400_000;

/* Calendar dates as UTC day numbers */

/** Days since 1970-01-01 for a calendar date. */
function dayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function toIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOf(day: number): number {
  return new Date(day * DAY_MS).getUTCDay();
}

export type ParsedDate = { ok: true; day: number; year: number } | { ok: false; message: string };

/** Parse a strict YYYY-MM-DD calendar date and check it exists. */
export function parseDate(input: string, field: string): ParsedDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return { ok: false, message: `${field} must be a date written YYYY-MM-DD, for example 2026-11-26. Got "${input.slice(0, 40)}".` };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const day = dayNumber(y, mo, d);
  if (mo < 1 || mo > 12 || toIso(day) !== `${m[1]}-${m[2]}-${m[3]}`) {
    return { ok: false, message: `${field} is ${input.trim()}, which is not a real calendar date.` };
  }
  return { ok: true, day, year: y };
}

export function yearRangeMessage(field: string, year: number): string | null {
  if (!Number.isInteger(year)) return `${field} must be a whole year, for example 2027.`;
  if (year < FIRST_YEAR || year > LAST_YEAR) {
    return `${field} is ${year}. This calendar covers ${FIRST_YEAR} through ${LAST_YEAR}: Juneteenth became a federal holiday in 2021, so earlier years follow a different list.`;
  }
  return null;
}

/* Holiday dates */

function actualDay(def: HolidayDef, year: number): number {
  const r = def.rule;
  if (r.kind === 'fixed') return dayNumber(year, r.month, r.day);
  if (r.kind === 'nth') {
    const first = dayNumber(year, r.month, 1);
    const offset = (r.weekday - weekdayOf(first) + 7) % 7;
    return first + offset + (r.n - 1) * 7;
  }
  const nextMonthFirst = r.month === 12 ? dayNumber(year + 1, 1, 1) : dayNumber(year, r.month + 1, 1);
  const last = nextMonthFirst - 1;
  const back = (weekdayOf(last) - r.weekday + 7) % 7;
  return last - back;
}

function observedDay(actual: number): number {
  const w = weekdayOf(actual);
  if (w === 6) return actual - 1; // Saturday: the Friday before
  if (w === 0) return actual + 1; // Sunday: the Monday after
  return actual;
}

export type Holiday = {
  id: string;
  name: string;
  date: string;
  weekday: string;
  observed: string;
  observed_weekday: string;
  rule: string;
  note?: string;
};

/** The eleven holidays whose actual date falls in `year`, with their observed dates. */
export function holidaysInYear(year: number): Holiday[] {
  return HOLIDAYS.map((def) => {
    const a = actualDay(def, year);
    const o = observedDay(a);
    const h: Holiday = {
      id: def.id,
      name: def.name,
      date: toIso(a),
      weekday: WEEKDAYS[weekdayOf(a)],
      observed: toIso(o),
      observed_weekday: WEEKDAYS[weekdayOf(o)],
      rule: def.ruleText,
    };
    if (o !== a) {
      h.note = `Falls on a ${WEEKDAYS[weekdayOf(a)]}, so it is observed on ${WEEKDAYS[weekdayOf(o)]} ${toIso(o)}${toIso(o).slice(0, 4) !== String(year) ? `, in ${toIso(o).slice(0, 4)}` : ''}.`;
    }
    return h;
  });
}

const observedCache = new Map<number, Map<number, Holiday>>();

/** Every observed holiday whose observed date falls in `year`, keyed by day number. */
function observedInYear(year: number): Map<number, Holiday> {
  let m = observedCache.get(year);
  if (m) return m;
  m = new Map();
  for (const y of [year - 1, year, year + 1]) {
    if (y < FIRST_YEAR - 1 || y > LAST_YEAR + 1) continue;
    for (const h of holidaysInYear(y)) {
      if (h.observed.startsWith(`${year}-`)) {
        const p = parseDate(h.observed, 'observed');
        if (p.ok) m.set(p.day, h);
      }
    }
  }
  observedCache.set(year, m);
  return m;
}

/** The holiday observed on this day, if any. */
export function observedHolidayOn(day: number): Holiday | null {
  const year = Number(toIso(day).slice(0, 4));
  return observedInYear(year).get(day) ?? null;
}

export function isWeekend(day: number): boolean {
  const w = weekdayOf(day);
  return w === 0 || w === 6;
}

export function isBusinessDay(day: number): boolean {
  return !isWeekend(day) && !observedHolidayOn(day);
}

/** Day numbers of the covered range, for bounds checks. */
export const MIN_DAY = dayNumber(FIRST_YEAR, 1, 1);
export const MAX_DAY = dayNumber(LAST_YEAR, 12, 31);

export function inRange(day: number): boolean {
  return day >= MIN_DAY && day <= MAX_DAY;
}

export function stepBusinessDay(day: number, dir: 1 | -1): number {
  let d = day + dir;
  while (!isBusinessDay(d)) d += dir;
  return d;
}

export type AddResult = { result: number; skippedWeekendDays: number; skippedHolidays: Holiday[] };

/**
 * Move `n` business days from `start`. The start date itself is never
 * counted: 1 business day after a Friday is the next Monday, or Tuesday when
 * that Monday is a holiday. With n = 0 the start date comes back when it is a
 * business day, otherwise the next business day.
 */
export function addBusinessDays(start: number, n: number): AddResult {
  const skippedHolidays: Holiday[] = [];
  let skippedWeekendDays = 0;
  if (n === 0) {
    let d = start;
    while (!isBusinessDay(d)) {
      if (isWeekend(d)) skippedWeekendDays++;
      else {
        const h = observedHolidayOn(d);
        if (h) skippedHolidays.push(h);
      }
      d += 1;
    }
    return { result: d, skippedWeekendDays, skippedHolidays };
  }
  const dir: 1 | -1 = n > 0 ? 1 : -1;
  let left = Math.abs(n);
  let d = start;
  while (left > 0) {
    d += dir;
    if (isWeekend(d)) {
      skippedWeekendDays++;
      continue;
    }
    const h = observedHolidayOn(d);
    if (h) {
      skippedHolidays.push(h);
      continue;
    }
    left--;
  }
  return { result: d, skippedWeekendDays, skippedHolidays };
}

/** Business days from `start` to `end`, both included. */
export function countBusinessDays(start: number, end: number): { businessDays: number; weekendDays: number; holidays: Holiday[] } {
  let businessDays = 0;
  let weekendDays = 0;
  const holidays: Holiday[] = [];
  for (let d = start; d <= end; d++) {
    if (isWeekend(d)) weekendDays++;
    else {
      const h = observedHolidayOn(d);
      if (h) holidays.push(h);
      else businessDays++;
    }
  }
  return { businessDays, weekendDays, holidays };
}

/** Today's date in a named IANA time zone, as a day number. */
export function todayIn(timeZone: string, now = new Date()): number {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const p = parseDate(iso, 'today');
  if (!p.ok) throw new Error(`Could not read today's date in ${timeZone}.`);
  return p.day;
}

export function dayOffset(from: number, to: number): number {
  return to - from;
}
