/**
 * Evals for the example connector, run against a live URL:
 *
 *   node eval/holidays.eval.mjs https://your-host.example.com
 *   node eval/holidays.eval.mjs              (defaults to EVAL_URL, then http://localhost:3000)
 *
 * Each case is a prompt a real user types, the tool call Claude makes for it,
 * and what the answer must contain. Expected dates come from the U.S. Office
 * of Personnel Management's published federal holiday schedules, not from
 * this server's own code. Copy this file per connector and replace the cases.
 */

import { all, errorMatching, runCases, specificError, succeeded, under } from './mcp-client.mjs';

const base = (process.argv[2] ?? process.env.EVAL_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const observedOf = (r, id) => r.data.holidays.find((h) => h.id === id)?.observed;
const expectObserved = (map) => (r) => {
  for (const [id, date] of Object.entries(map)) {
    const got = observedOf(r, id);
    if (got !== date) return `${id} observed ${got}, expected ${date}`;
  }
  return true;
};
const field = (name, value) => (r) => (JSON.stringify(r.data[name]) === JSON.stringify(value) ? true : `${name} is ${JSON.stringify(r.data[name])}, expected ${JSON.stringify(value)}`);
const skipped = (ids) => (r) => {
  const got = (r.data.holidays_skipped ?? r.data.holidays).map((h) => h.name);
  return got.length === ids.length && ids.every((n, i) => got[i].startsWith(n)) ? true : `holidays were ${JSON.stringify(got)}, expected ${JSON.stringify(ids)}`;
};
const scoped = (r) => (typeof r.data.scope === 'string' && /federal holidays/.test(r.data.scope) ? true : 'scope note missing');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

const cases = [
  {
    prompt: 'Which federal holidays fall on a weekend in 2027, and which days are they observed instead?',
    tool: 'list_federal_holidays',
    args: { year: 2027 },
    check: all(succeeded, under(8_000), expectObserved({ juneteenth: '2027-06-18', independence_day: '2027-07-05', christmas_day: '2027-12-24' }), (r) => (r.data.holidays.filter((h) => h.note).length === 3 ? true : 'expected exactly three weekend shifts')),
  },
  {
    prompt: 'An invoice dated 2026-11-20 is due in 10 business days. What date is that, and which holidays did you skip?',
    tool: 'add_business_days',
    args: { start_date: '2026-11-20', business_days: 10 },
    check: all(succeeded, field('result_date', '2026-12-07'), skipped(['Thanksgiving Day']), scoped),
  },
  {
    prompt: 'How many business days are there between 2026-12-01 and 2027-01-15?',
    tool: 'count_business_days',
    args: { start_date: '2026-12-01', end_date: '2027-01-15' },
    check: all(succeeded, field('business_days', 32), skipped(['Christmas Day', "New Year's Day"])),
  },
  {
    prompt: 'List every federal holiday in 2026 with the day federal offices are closed.',
    tool: 'list_federal_holidays',
    args: { year: 2026 },
    check: all(
      succeeded,
      (r) => (r.data.holidays.length === 11 ? true : `${r.data.holidays.length} holidays`),
      expectObserved({ new_years_day: '2026-01-01', mlk_day: '2026-01-19', washingtons_birthday: '2026-02-16', memorial_day: '2026-05-25', juneteenth: '2026-06-19', independence_day: '2026-07-03', labor_day: '2026-09-07', columbus_day: '2026-10-12', veterans_day: '2026-11-11', thanksgiving_day: '2026-11-26', christmas_day: '2026-12-25' }),
    ),
  },
  {
    prompt: 'Are federal offices open on July 3, 2026?',
    tool: 'check_business_day',
    args: { date: '2026-07-03' },
    check: all(succeeded, field('is_business_day', false), (r) => (r.data.observed_holiday?.name === 'Independence Day' ? true : 'Independence Day not reported')),
  },
  {
    prompt: 'Is the Friday after Thanksgiving 2026 a business day?',
    tool: 'check_business_day',
    args: { date: '2026-11-27' },
    check: all(succeeded, field('is_business_day', true), field('previous_business_day', '2026-11-25'), field('next_business_day', '2026-11-30')),
  },
  {
    prompt: 'Was December 31, 2021 a federal holiday?',
    tool: 'check_business_day',
    args: { date: '2021-12-31' },
    check: all(succeeded, field('is_business_day', false), (r) => (r.data.observed_holiday?.name === "New Year's Day" && r.data.observed_holiday?.date === '2022-01-01' ? true : "New Year's Day 2022 not reported")),
  },
  {
    prompt: 'Which day was Juneteenth observed in 2022?',
    tool: 'check_business_day',
    args: { date: '2022-06-20' },
    check: all(succeeded, (r) => (r.data.observed_holiday?.name.startsWith('Juneteenth') ? true : 'Juneteenth not reported')),
  },
  {
    prompt: 'What are the next three federal holidays after October 11, 2026?',
    tool: 'next_federal_holidays',
    args: { from_date: '2026-10-11', count: 3 },
    check: all(succeeded, (r) => (JSON.stringify(r.data.holidays.map((h) => [h.id, h.observed, h.days_away])) === JSON.stringify([['columbus_day', '2026-10-12', 1], ['veterans_day', '2026-11-11', 31], ['thanksgiving_day', '2026-11-26', 46]]) ? true : `got ${JSON.stringify(r.data.holidays.map((h) => h.observed))}`)),
  },
  {
    prompt: 'When is the next federal holiday?',
    tool: 'next_federal_holidays',
    args: {},
    check: all(succeeded, field('from_date', today), (r) => (r.data.holidays.length === 1 && r.data.holidays[0].observed >= today && /today in America\/New_York/.test(r.data.from_date_source) ? true : 'did not start from today')),
  },
  {
    prompt: 'What federal holidays are left in 2026 after Christmas week starts?',
    tool: 'next_federal_holidays',
    args: { from_date: '2026-12-26', count: 2 },
    check: all(succeeded, (r) => (r.data.holidays.map((h) => h.observed).join() === '2027-01-01,2027-01-18' ? true : `got ${r.data.holidays.map((h) => h.observed).join()}`)),
  },
  {
    prompt: 'Give me all eleven federal holidays starting January 1, 2026.',
    tool: 'next_federal_holidays',
    args: { from_date: '2026-01-01', count: 11 },
    check: all(succeeded, under(8_000), (r) => (r.data.holidays.length === 11 && r.data.holidays[0].days_away === 0 && r.data.holidays[10].observed === '2026-12-25' ? true : 'wrong year of holidays')),
  },
  {
    prompt: 'A contract says notice must arrive 30 business days before March 1, 2027. What is the last day to send it?',
    tool: 'add_business_days',
    args: { start_date: '2027-03-01', business_days: -30 },
    check: all(succeeded, field('result_date', '2027-01-14'), skipped(["Washington's Birthday", 'Birthday of Martin Luther King'])),
  },
  {
    prompt: 'I leave on Friday 2026-12-18 and come back after New Year. How many business days is that through 2027-01-01?',
    tool: 'count_business_days',
    args: { start_date: '2026-12-18', end_date: '2027-01-01' },
    check: all(succeeded, field('business_days', 9)),
  },
  {
    prompt: 'How many business days are in the first quarter of 2027?',
    tool: 'count_business_days',
    args: { start_date: '2027-01-01', end_date: '2027-03-31' },
    check: all(succeeded, field('business_days', 61), field('calendar_days', 90)),
  },
  {
    prompt: 'An order placed Saturday, July 4, 2026 ships the same business day. When does it ship?',
    tool: 'add_business_days',
    args: { start_date: '2026-07-04', business_days: 0 },
    check: all(succeeded, field('result_date', '2026-07-06')),
  },
  {
    prompt: 'A payment sent Friday, January 15, 2027 takes one business day. When does it land?',
    tool: 'add_business_days',
    args: { start_date: '2027-01-15', business_days: 1 },
    check: all(succeeded, field('result_date', '2027-01-19'), skipped(['Birthday of Martin Luther King'])),
  },
  {
    prompt: 'When is Thanksgiving in 2030?',
    tool: 'list_federal_holidays',
    args: { year: 2030 },
    check: all(succeeded, (r) => {
      const t = r.data.holidays.find((h) => h.id === 'thanksgiving_day');
      const d = Number(t.date.slice(8));
      return t.weekday === 'Thursday' && t.date.startsWith('2030-11-') && d >= 22 && d <= 28 ? true : `got ${t.date} ${t.weekday}`;
    }),
  },
  {
    prompt: 'Is New Year\'s Eve 2027 a day off for federal workers?',
    tool: 'check_business_day',
    args: { date: '2027-12-31' },
    check: all(succeeded, field('is_business_day', false), (r) => (r.data.observed_holiday?.date === '2028-01-01' ? true : 'New Year 2028 observance missing')),
  },
  {
    prompt: 'Which holidays in 2032 are observed on a different day than the date itself?',
    tool: 'list_federal_holidays',
    args: { year: 2032 },
    check: all(succeeded, (r) => (r.data.holidays.every((h) => !['Saturday', 'Sunday'].includes(h.observed_weekday)) && r.data.holidays.filter((h) => h.note).every((h) => h.observed !== h.date) ? true : 'an observed date lands on a weekend')),
  },
  {
    prompt: 'Is February 30, 2026 a business day?',
    tool: 'check_business_day',
    args: { date: '2026-02-30' },
    check: all(errorMatching(/not a real calendar date/), specificError),
  },
  {
    prompt: 'List the federal holidays for 2019.',
    tool: 'list_federal_holidays',
    args: { year: 2019 },
    check: all(errorMatching(/2021 through 2100/), specificError),
  },
  {
    prompt: 'Is 11/26/2026 a business day?',
    tool: 'check_business_day',
    args: { date: '11/26/2026' },
    check: all(errorMatching(/YYYY-MM-DD/), specificError),
  },
  {
    prompt: 'What date is 5,000 business days from today?',
    tool: 'add_business_days',
    args: { start_date: '2026-10-11', business_days: 5000 },
    check: all(errorMatching(/-1000 to 1000/), specificError),
  },
  {
    prompt: 'Count business days from 2027-01-15 back to 2026-12-01.',
    tool: 'count_business_days',
    args: { start_date: '2027-01-15', end_date: '2026-12-01' },
    check: all(errorMatching(/Swap them/), specificError),
  },
  {
    prompt: 'How many business days are there from 2021 to 2040?',
    tool: 'count_business_days',
    args: { start_date: '2021-01-01', end_date: '2040-01-01' },
    check: all(errorMatching(/at most 3,660/), specificError),
  },
  {
    prompt: 'List the next 20 federal holidays.',
    tool: 'next_federal_holidays',
    args: { count: 20 },
    check: all(errorMatching(/1 to 11/), specificError),
  },
  {
    prompt: 'What is 5 business days after December 30, 2100?',
    tool: 'add_business_days',
    args: { start_date: '2100-12-30', business_days: 5 },
    check: all(errorMatching(/past the calendar's range/), specificError),
  },
];

await runCases(`${base}/holidays`, cases, {
  expectTools: ['list_federal_holidays', 'next_federal_holidays', 'check_business_day', 'add_business_days', 'count_business_days'],
  maxMs: 5_000,
});
