import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessDays, countBusinessDays, holidaysInYear, isBusinessDay, observedHolidayOn, parseDate, toIso, yearRangeMessage } from '../lib/holidays/engine.ts';

const day = (iso: string) => {
  const p = parseDate(iso, 'date');
  if (!p.ok) throw new Error(p.message);
  return p.day;
};
const observed = (year: number) => Object.fromEntries(holidaysInYear(year).map((h) => [h.id, h.observed]));

// Observed dates as published by the U.S. Office of Personnel Management.
test('2021 observed dates, including Saturday and Sunday shifts', () => {
  assert.deepEqual(observed(2021), {
    new_years_day: '2021-01-01',
    mlk_day: '2021-01-18',
    washingtons_birthday: '2021-02-15',
    memorial_day: '2021-05-31',
    juneteenth: '2021-06-18',
    independence_day: '2021-07-05',
    labor_day: '2021-09-06',
    columbus_day: '2021-10-11',
    veterans_day: '2021-11-11',
    thanksgiving_day: '2021-11-25',
    christmas_day: '2021-12-24',
  });
});

test('2023 observed dates', () => {
  assert.deepEqual(observed(2023), {
    new_years_day: '2023-01-02',
    mlk_day: '2023-01-16',
    washingtons_birthday: '2023-02-20',
    memorial_day: '2023-05-29',
    juneteenth: '2023-06-19',
    independence_day: '2023-07-04',
    labor_day: '2023-09-04',
    columbus_day: '2023-10-09',
    veterans_day: '2023-11-10',
    thanksgiving_day: '2023-11-23',
    christmas_day: '2023-12-25',
  });
});

test('2026 observed dates', () => {
  assert.deepEqual(observed(2026), {
    new_years_day: '2026-01-01',
    mlk_day: '2026-01-19',
    washingtons_birthday: '2026-02-16',
    memorial_day: '2026-05-25',
    juneteenth: '2026-06-19',
    independence_day: '2026-07-03',
    labor_day: '2026-09-07',
    columbus_day: '2026-10-12',
    veterans_day: '2026-11-11',
    thanksgiving_day: '2026-11-26',
    christmas_day: '2026-12-25',
  });
});

test('New Year\'s Day on a Saturday is observed on December 31 of the year before', () => {
  const ny2022 = holidaysInYear(2022).find((h) => h.id === 'new_years_day');
  assert.equal(ny2022?.observed, '2021-12-31');
  assert.match(ny2022?.note ?? '', /in 2021/);
  assert.equal(observedHolidayOn(day('2021-12-31'))?.id, 'new_years_day');
  assert.equal(isBusinessDay(day('2021-12-31')), false);
  assert.equal(observedHolidayOn(day('2027-12-31'))?.id, 'new_years_day');
});

test('weekends and observed holidays are not business days; actual Saturday dates are just weekends', () => {
  assert.equal(isBusinessDay(day('2026-11-26')), false); // Thanksgiving
  assert.equal(isBusinessDay(day('2026-07-03')), false); // Independence Day observed
  assert.equal(observedHolidayOn(day('2026-07-04')), null); // the Saturday itself
  assert.equal(isBusinessDay(day('2026-07-04')), false);
  assert.equal(isBusinessDay(day('2026-11-27')), true);
});

test('add_business_days skips Thanksgiving and never counts the start date', () => {
  const r = addBusinessDays(day('2026-11-20'), 10);
  assert.equal(toIso(r.result), '2026-12-07');
  assert.deepEqual(r.skippedHolidays.map((h) => h.id), ['thanksgiving_day']);
  assert.equal(toIso(addBusinessDays(day('2027-01-15'), 1).result), '2027-01-19'); // Friday, then MLK Monday
  assert.equal(toIso(addBusinessDays(day('2027-01-19'), -1).result), '2027-01-15');
  assert.equal(toIso(addBusinessDays(day('2026-07-03'), 0).result), '2026-07-06');
  assert.equal(toIso(addBusinessDays(day('2026-07-06'), 0).result), '2026-07-06');
});

test('count_business_days includes both ends and leaves out holidays', () => {
  const c = countBusinessDays(day('2026-12-01'), day('2027-01-15'));
  assert.equal(c.businessDays, 32);
  assert.deepEqual(c.holidays.map((h) => h.id), ['christmas_day', 'new_years_day']);
  assert.equal(countBusinessDays(day('2026-11-26'), day('2026-11-26')).businessDays, 0);
});

test('dates and years are validated with specific messages', () => {
  const bad = parseDate('2026-02-30', 'date');
  assert.equal(bad.ok, false);
  assert.match(bad.ok ? '' : bad.message, /not a real calendar date/);
  const fmt = parseDate('11/26/2026', 'date');
  assert.match(fmt.ok ? '' : fmt.message, /YYYY-MM-DD/);
  assert.match(yearRangeMessage('year', 2019) ?? '', /2021 through 2100/);
  assert.equal(yearRangeMessage('year', 2050), null);
});

test('every year in range has eleven distinct holidays, each observed on a weekday', () => {
  for (let y = 2021; y <= 2100; y++) {
    const list = holidaysInYear(y);
    assert.equal(list.length, 11, String(y));
    assert.equal(new Set(list.map((h) => h.observed)).size, 11, String(y));
    for (const h of list) assert.ok(!['Saturday', 'Sunday'].includes(h.observed_weekday), `${y} ${h.id}`);
  }
});
