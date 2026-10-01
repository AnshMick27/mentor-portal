/** India Standard Time: UTC+05:30 all year (no daylight saving), so a fixed offset is exact. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const istFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** e.g. "5 Oct 2026, 11:59 pm IST". Every date shown to users goes through this (SPEC.md §11). */
export function formatIst(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${istFormatter.format(date)} IST`;
}

const istShortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
});

/** e.g. "28 Sept" — the IST calendar day, for compact labels such as chart axes. */
export function formatIstShortDate(time: number): string {
  return Number.isNaN(time) ? "—" : istShortDateFormatter.format(new Date(time));
}

/** ISO instant → `YYYY-MM-DDTHH:mm` in IST, the value format of `<input type="datetime-local">`. */
export function toIstInputValue(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Date(time + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * `datetime-local` value, read as IST whatever the browser's time zone → ISO string with `+05:30`.
 * Returns undefined for blank or impossible values (e.g. 31 February).
 */
export function fromIstInputValue(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const iso = `${value}:00+05:30`;
  return toIstInputValue(iso) === value ? iso : undefined;
}
