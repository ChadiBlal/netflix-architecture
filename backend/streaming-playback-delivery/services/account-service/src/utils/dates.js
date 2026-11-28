// Adds one calendar month in UTC, clamping the day (Jan 31 -> Feb 28/29).
function addMonth(date) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}
const addDays = (date, n) => new Date(new Date(date).getTime() + n * 86400000);
module.exports = { addMonth, addDays };
