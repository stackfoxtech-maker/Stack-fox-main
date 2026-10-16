/**
 * India Standard Time calendar parts, independent of the server's time zone.
 *
 * The cron schedules are written in IST (UTC+5:30, no DST) but a container usually
 * runs in UTC, so `getMonth()`/`getDay()` on a fresh Date answered for the wrong
 * day around midnight IST: the quarterly SOFTEX run filed the wrong quarter and the
 * weekly timesheets were created a week early. Shift by the fixed offset and read
 * the UTC fields.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function istParts(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-11
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(), // 0 = Sunday
  };
}

/** The instant IST midnight begins on the given IST calendar day. */
export function istMidnight(year: number, month: number, date: number): Date {
  return new Date(Date.UTC(year, month, date) - IST_OFFSET_MS);
}
