import assert from "node:assert/strict";
import { test } from "node:test";
const { effectiveAppearance, formatTimeOfDay, isDarkInWindow, parseTimeOfDay, scheduledAppearance, sunTimes } = await import("./appearanceSchedule.ts");

const base = {
  appearanceSchedule: "off",
  appearanceScheduleStart: "22:00",
  appearanceScheduleEnd: "07:00",
  appearanceScheduleLatitude: null,
  appearanceScheduleLongitude: null,
};

const at = (date, minutes) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes);
const offsetOn = (date) => -new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)).getTimezoneOffset();
const closeEnough = (actual, expected) => {
  const diff = Math.abs(actual - expected) % 1440;
  return Math.min(diff, 1440 - diff) <= 12;
};

test("times of day parse leniently and format back to HH:MM", () => {
  assert.equal(parseTimeOfDay("22:00"), 1320);
  assert.equal(parseTimeOfDay("07:05"), 425);
  assert.equal(parseTimeOfDay("7:5"), 425);
  assert.equal(parseTimeOfDay(" 9:30 "), 570);
  assert.equal(parseTimeOfDay("00:00"), 0);
  for (const bad of ["", "abc", "24:00", "22:60", "7", "22:00:00", "12:345", "-1:00"]) assert.equal(parseTimeOfDay(bad), null, bad);
  assert.equal(formatTimeOfDay(1320), "22:00");
  assert.equal(formatTimeOfDay(425), "07:05");
  assert.equal(formatTimeOfDay(0), "00:00");
  assert.equal(formatTimeOfDay(1439), "23:59");
});

test("a dark window covers its span and wraps past midnight", () => {
  assert.equal(isDarkInWindow(1320, 1320, 420), true);
  assert.equal(isDarkInWindow(419, 1320, 420), true);
  assert.equal(isDarkInWindow(420, 1320, 420), false);
  assert.equal(isDarkInWindow(720, 1320, 420), false);
  assert.equal(isDarkInWindow(720, 480, 1200), true);
  assert.equal(isDarkInWindow(1199, 480, 1200), true);
  assert.equal(isDarkInWindow(1200, 480, 1200), false);
  assert.equal(isDarkInWindow(479, 480, 1200), false);
  assert.equal(isDarkInWindow(720, 600, 600), false);
});

test("sunrise and sunset match the almanac within a few minutes", () => {
  const london = new Date(2026, 5, 21, 12);
  const londonTimes = sunTimes(london, 51.5, -0.12);
  assert.ok(londonTimes !== null && londonTimes !== "polarDay" && londonTimes !== "polarNight");
  if (londonTimes !== null && londonTimes !== "polarDay" && londonTimes !== "polarNight") {
    assert.ok(closeEnough(londonTimes.sunrise, 223 + offsetOn(london)), `sunrise ${londonTimes.sunrise}`);
    assert.ok(closeEnough(londonTimes.sunset, 1221 + offsetOn(london)), `sunset ${londonTimes.sunset}`);
  }
  const chandigarh = new Date(2026, 10, 28, 12);
  const chandigarhTimes = sunTimes(chandigarh, 30.73, 76.77);
  assert.ok(chandigarhTimes !== null && chandigarhTimes !== "polarDay" && chandigarhTimes !== "polarNight");
  if (chandigarhTimes !== null && chandigarhTimes !== "polarDay" && chandigarhTimes !== "polarNight") {
    assert.ok(closeEnough(chandigarhTimes.sunrise, 87 + offsetOn(chandigarh)), `sunrise ${chandigarhTimes.sunrise}`);
    assert.ok(closeEnough(chandigarhTimes.sunset, 710 + offsetOn(chandigarh)), `sunset ${chandigarhTimes.sunset}`);
  }
  const equinox = new Date(2026, 2, 20, 12);
  const equinoxTimes = sunTimes(equinox, 0, 0);
  assert.ok(equinoxTimes !== null && equinoxTimes !== "polarDay" && equinoxTimes !== "polarNight");
  if (equinoxTimes !== null && equinoxTimes !== "polarDay" && equinoxTimes !== "polarNight") {
    assert.ok(closeEnough(equinoxTimes.sunrise, 364 + offsetOn(equinox)), `sunrise ${equinoxTimes.sunrise}`);
    assert.ok(closeEnough(equinoxTimes.sunset, 1091 + offsetOn(equinox)), `sunset ${equinoxTimes.sunset}`);
  }
});

test("the polar day stays light and the polar night stays dark", () => {
  assert.equal(sunTimes(new Date(2026, 5, 21, 12), 78, 16), "polarDay");
  assert.equal(sunTimes(new Date(2026, 11, 21, 12), 78, 16), "polarNight");
  assert.equal(sunTimes(new Date(2026, 5, 21, 12), 100, 0), null);
  assert.equal(sunTimes(new Date(2026, 5, 21, 12), Number.NaN, 0), null);
});

test("custom times switch dark at night and light by day", () => {
  const custom = { ...base, appearanceSchedule: "custom" };
  assert.equal(scheduledAppearance(custom, new Date(2026, 5, 21, 23, 0)), "dark");
  assert.equal(scheduledAppearance(custom, new Date(2026, 5, 21, 6, 59)), "dark");
  assert.equal(scheduledAppearance(custom, new Date(2026, 5, 21, 7, 0)), "light");
  assert.equal(scheduledAppearance(custom, new Date(2026, 5, 21, 12, 0)), "light");
  assert.equal(scheduledAppearance(base, new Date(2026, 5, 21, 23, 0)), null);
  assert.equal(scheduledAppearance({ ...custom, appearanceScheduleStart: "nope" }, new Date(2026, 5, 21, 23, 0)), null);
});

test("sunset mode follows the sun and needs a location", () => {
  const sunset = { ...base, appearanceSchedule: "sunset", appearanceScheduleLatitude: 51.5, appearanceScheduleLongitude: -0.12 };
  assert.equal(scheduledAppearance({ ...base, appearanceSchedule: "sunset" }, new Date(2026, 5, 21, 23, 0)), null);
  const day = new Date(2026, 5, 21, 12);
  const times = sunTimes(day, 51.5, -0.12);
  assert.ok(times !== null && times !== "polarDay" && times !== "polarNight");
  if (times !== null && times !== "polarDay" && times !== "polarNight") {
    assert.equal(scheduledAppearance(sunset, at(day, times.sunrise - 60)), "dark");
    assert.equal(scheduledAppearance(sunset, at(day, times.sunrise + 60)), "light");
    assert.equal(scheduledAppearance(sunset, at(day, times.sunset - 60)), "light");
    assert.equal(scheduledAppearance(sunset, at(day, times.sunset + 60)), "dark");
  }
  const polarDay = { ...sunset, appearanceScheduleLatitude: 78, appearanceScheduleLongitude: 16 };
  assert.equal(scheduledAppearance(polarDay, new Date(2026, 5, 21, 23, 0)), "light");
  assert.equal(scheduledAppearance(polarDay, new Date(2026, 11, 21, 23, 0)), "dark");
});

test("the schedule overrides the manual appearance only while it is on", () => {
  const manual = { ...base, appearance: "light" };
  assert.equal(effectiveAppearance(manual, new Date(2026, 5, 21, 23, 0)), "light");
  assert.equal(effectiveAppearance({ ...manual, appearanceSchedule: "custom" }, new Date(2026, 5, 21, 23, 0)), "dark");
  assert.equal(effectiveAppearance({ ...manual, appearanceSchedule: "custom" }, new Date(2026, 5, 21, 12, 0)), "light");
  assert.equal(effectiveAppearance({ ...manual, appearanceSchedule: "sunset" }, new Date(2026, 5, 21, 23, 0)), "light");
  assert.equal(effectiveAppearance({ ...manual, appearance: "auto" }, new Date(2026, 5, 21, 23, 0)), "auto");
});
