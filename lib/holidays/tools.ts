/**
 * The example connector: a U.S. federal holiday and business-day calendar.
 *
 * Five read-only tools, each declared as a ToolSpec so the conventions in
 * lib/mcp/tool.ts are enforced at load time. Every tool validates its own
 * inputs and returns a sentence that says what to change, because a raw
 * schema error reads as "Bad Request" to a reviewer.
 */

import { z } from 'zod';
import { fail, ok, type Outcome, type ToolSpec } from '../mcp/tool.ts';
import type { Rule } from '../mcp/limits.ts';
import {
  FIRST_YEAR,
  LAST_YEAR,
  MAX_DAY,
  MIN_DAY,
  SCOPE_NOTE,
  SOURCE,
  WEEKDAYS,
  addBusinessDays,
  countBusinessDays,
  holidaysInYear,
  inRange,
  isBusinessDay,
  isWeekend,
  observedHolidayOn,
  parseDate,
  stepBusinessDay,
  toIso,
  todayIn,
  weekdayOf,
  yearRangeMessage,
  type Holiday,
} from './engine.ts';

export const SERVER_NAME = 'Holiday Calendar (example) by Modern Mustard Seed';
export const SERVER_VERSION = '1.0.0';
export const TODAY_ZONE = 'America/New_York';
export const MAX_BUSINESS_DAYS = 1_000;
export const MAX_COUNT_SPAN_DAYS = 3_660;

/** Shared by every instance. Pure arithmetic is cheap, so this only stops a runaway loop from billing function time. */
const GLOBAL: { what: string; rules: Rule[] } = {
  what: 'The holiday calendar',
  rules: [
    { name: 'holidays-minute', limit: 3_000, window: '1 m', label: 'this minute' },
    { name: 'holidays-day', limit: 500_000, window: '1 d', label: 'today' },
  ],
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const dateField = (what: string) => z.string().max(40).describe(`${what}, written YYYY-MM-DD (for example 2026-11-26). Covers ${FIRST_YEAR} through ${LAST_YEAR}.`);

function brief(h: Holiday) {
  return { name: h.name, date: h.date, observed: h.observed, observed_weekday: h.observed_weekday };
}

function dateInRange(input: string, field: string): Outcome<number> {
  const p = parseDate(input, field);
  if (!p.ok) return fail('bad_date', p.message);
  if (!inRange(p.day)) return fail('out_of_range', `${field} is ${input.trim()}. This calendar covers ${toIso(MIN_DAY)} through ${toIso(MAX_DAY)}.`);
  return ok(p.day);
}

/* list_federal_holidays */

const listInput = z.object({
  year: z.number().int().describe(`Calendar year, ${FIRST_YEAR} through ${LAST_YEAR}.`),
});

export const listFederalHolidays: ToolSpec<typeof listInput> = {
  name: 'list_federal_holidays',
  title: 'List federal holidays',
  description: `List the eleven U.S. federal holidays for one calendar year (${FIRST_YEAR} through ${LAST_YEAR}): each holiday's name, its actual date and weekday, the date it is observed when it falls on a weekend (Saturday moves to the Friday before, Sunday to the Monday after), and the rule that sets it, from 5 U.S.C. 6103. Use it to answer which days federal offices close in a year.`,
  inputSchema: listInput,
  annotations: READ_ONLY,
  perMinute: 300,
  global: GLOBAL,
  logFields: (a) => ({ year: a.year }),
  run: ({ year }) => {
    const bad = yearRangeMessage('year', year);
    if (bad) return fail('out_of_range', bad);
    return ok({ year, holidays: holidaysInYear(year), source: SOURCE, scope: SCOPE_NOTE });
  },
};

/* next_federal_holidays */

const nextInput = z.object({
  from_date: dateField('Start looking on this date, inclusive').optional(),
  count: z.number().int().optional().describe('How many upcoming holidays to return, 1 to 11. Defaults to 1.'),
});

export const nextFederalHolidays: ToolSpec<typeof nextInput> = {
  name: 'next_federal_holidays',
  title: 'Find the next federal holidays',
  description: `Find the next one to eleven U.S. federal holidays observed on or after a date, with each one's observed date and how many calendar days away it is. Without from_date it starts from today's date in ${TODAY_ZONE} and says which date it used.`,
  inputSchema: nextInput,
  annotations: READ_ONLY,
  perMinute: 300,
  global: GLOBAL,
  logFields: (a) => ({ count: a.count ?? 1, from_given: Boolean(a.from_date) }),
  run: ({ from_date, count }) => {
    const n = count ?? 1;
    if (!Number.isInteger(n) || n < 1 || n > 11) return fail('bad_count', `count is ${n}. Ask for 1 to 11 holidays, one full year at most.`);
    let from: number;
    if (from_date) {
      const d = dateInRange(from_date, 'from_date');
      if (!d.ok) return d;
      from = d.data;
    } else {
      from = todayIn(TODAY_ZONE);
    }
    const found: (Holiday & { days_away: number })[] = [];
    const startYear = Number(toIso(from).slice(0, 4));
    for (let y = startYear; y <= Math.min(LAST_YEAR, startYear + 2) && found.length < n; y++) {
      for (const h of holidaysInYear(y)) {
        const o = parseDate(h.observed, 'observed');
        if (o.ok && o.day >= from && !found.some((f) => f.id === h.id && f.date === h.date)) found.push({ ...h, days_away: o.day - from });
      }
      found.sort((a, b) => a.observed.localeCompare(b.observed));
    }
    const holidays = found.slice(0, n);
    if (!holidays.length) return fail('out_of_range', `There are no federal holidays in this calendar after ${toIso(from)}. It covers ${FIRST_YEAR} through ${LAST_YEAR}.`);
    return ok({ from_date: toIso(from), from_date_source: from_date ? 'given' : `today in ${TODAY_ZONE}`, holidays, source: SOURCE });
  },
};

/* check_business_day */

const checkInput = z.object({ date: dateField('The date to check') });

export const checkBusinessDay: ToolSpec<typeof checkInput> = {
  name: 'check_business_day',
  title: 'Check a business day',
  description: 'Check whether a date is a U.S. business day (a weekday that is not an observed federal holiday). Returns the weekday, the holiday observed that day if any, and the business days just before and just after it.',
  inputSchema: checkInput,
  annotations: READ_ONLY,
  perMinute: 300,
  global: GLOBAL,
  run: ({ date }) => {
    const d = dateInRange(date, 'date');
    if (!d.ok) return d;
    const day = d.data;
    const holiday = observedHolidayOn(day);
    const prev = stepBusinessDay(day, -1);
    const next = stepBusinessDay(day, 1);
    return ok({
      date: toIso(day),
      weekday: WEEKDAYS[weekdayOf(day)],
      is_business_day: isBusinessDay(day),
      is_weekend: isWeekend(day),
      observed_holiday: holiday ? brief(holiday) : null,
      previous_business_day: toIso(prev),
      next_business_day: toIso(next),
      scope: SCOPE_NOTE,
    });
  },
};

/* add_business_days */

const addInput = z.object({
  start_date: dateField('The date to count from. It is not counted itself'),
  business_days: z.number().int().describe(`Business days to move, -${MAX_BUSINESS_DAYS} to ${MAX_BUSINESS_DAYS}. Negative counts backward. 0 returns the start date if it is a business day, otherwise the next one.`),
});

export const addBusinessDaysTool: ToolSpec<typeof addInput> = {
  name: 'add_business_days',
  title: 'Add business days',
  description: `Move a number of U.S. business days forward or backward from a date, skipping weekends and observed federal holidays, for due dates, delivery windows and notice periods. The start date is not counted: 1 business day after a Friday is the next Monday, or Tuesday when that Monday is a holiday. Returns the resulting date and every holiday it skipped. Up to ${MAX_BUSINESS_DAYS.toLocaleString('en-US')} business days either way.`,
  inputSchema: addInput,
  annotations: READ_ONLY,
  perMinute: 300,
  global: GLOBAL,
  logFields: (a) => ({ business_days: a.business_days }),
  run: ({ start_date, business_days }) => {
    if (!Number.isInteger(business_days) || Math.abs(business_days) > MAX_BUSINESS_DAYS) {
      return fail('bad_count', `business_days is ${business_days}. Use a whole number from -${MAX_BUSINESS_DAYS} to ${MAX_BUSINESS_DAYS}.`);
    }
    const d = dateInRange(start_date, 'start_date');
    if (!d.ok) return d;
    const r = addBusinessDays(d.data, business_days);
    if (!inRange(r.result)) return fail('out_of_range', `Moving ${business_days} business days from ${toIso(d.data)} goes past the calendar's range, ${toIso(MIN_DAY)} through ${toIso(MAX_DAY)}.`);
    return ok({
      start_date: toIso(d.data),
      business_days,
      result_date: toIso(r.result),
      result_weekday: WEEKDAYS[weekdayOf(r.result)],
      calendar_days: r.result - d.data,
      weekend_days_skipped: r.skippedWeekendDays,
      holidays_skipped: r.skippedHolidays.map(brief),
      scope: SCOPE_NOTE,
    });
  },
};

/* count_business_days */

const countInput = z.object({
  start_date: dateField('First date of the span, counted if it is a business day'),
  end_date: dateField('Last date of the span, counted if it is a business day'),
});

export const countBusinessDaysTool: ToolSpec<typeof countInput> = {
  name: 'count_business_days',
  title: 'Count business days',
  description: `Count the U.S. business days between two dates, both dates included, leaving out weekends and observed federal holidays. Returns the business day count, the weekend days, and each holiday that fell in the span. Spans up to ${MAX_COUNT_SPAN_DAYS.toLocaleString('en-US')} calendar days.`,
  inputSchema: countInput,
  annotations: READ_ONLY,
  perMinute: 300,
  global: GLOBAL,
  run: ({ start_date, end_date }) => {
    const s = dateInRange(start_date, 'start_date');
    if (!s.ok) return s;
    const e = dateInRange(end_date, 'end_date');
    if (!e.ok) return e;
    if (e.data < s.data) return fail('bad_order', `end_date ${toIso(e.data)} is before start_date ${toIso(s.data)}. Swap them.`);
    const span = e.data - s.data + 1;
    if (span > MAX_COUNT_SPAN_DAYS) return fail('too_long', `That span is ${span.toLocaleString('en-US')} calendar days. Count at most ${MAX_COUNT_SPAN_DAYS.toLocaleString('en-US')} at a time and add the parts.`);
    const c = countBusinessDays(s.data, e.data);
    return ok({
      start_date: toIso(s.data),
      end_date: toIso(e.data),
      calendar_days: span,
      business_days: c.businessDays,
      weekend_days: c.weekendDays,
      holidays: c.holidays.map(brief),
      scope: SCOPE_NOTE,
    });
  },
};

export const HOLIDAY_TOOLS = [listFederalHolidays, nextFederalHolidays, checkBusinessDay, addBusinessDaysTool, countBusinessDaysTool] as const;

export const INSTRUCTIONS =
  'A U.S. federal holiday calendar with business-day arithmetic. list_federal_holidays gives a year of holidays with observed dates; next_federal_holidays finds the coming ones; check_business_day says whether a date is a business day; add_business_days and count_business_days do due-date math that skips weekends and observed federal holidays. Every tool is read-only, deterministic and makes no network calls.';

export const EXAMPLE_PROMPTS = [
  'Which federal holidays fall on a weekend in 2027, and which days are they observed instead?',
  'An invoice dated 2026-11-20 is due in 10 business days. What date is that, and which holidays did you skip?',
  'How many business days are there between 2026-12-01 and 2027-01-15?',
] as const;
