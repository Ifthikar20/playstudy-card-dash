/**
 * Minimal iCalendar (.ics) reader — enough for Google Calendar, Outlook and
 * school-portal exports: VEVENT blocks with SUMMARY / DTSTART / DTEND /
 * DESCRIPTION / UID / LOCATION. Recurrence rules are not expanded (the first
 * occurrence is imported and flagged in `warnings`).
 */

export interface IcsEvent {
  uid: string;
  title: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  description?: string;
  location?: string;
}

export interface IcsParseResult {
  events: IcsEvent[];
  warnings: string[];
}

/** RFC 5545 §3.1 — long lines are folded with CRLF + single whitespace. */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .split(/\r?\n/);
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Parses 20260904, 20260904T133000 (floating / TZID → local) or 20260904T133000Z (UTC). */
function parseDate(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  if (params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return { date: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)))
    : new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  return { date, allDay: false };
}

export function parseIcs(text: string): IcsParseResult {
  const lines = unfold(text);
  const events: IcsEvent[] = [];
  const warnings: string[] = [];
  let cur: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) {
        const start = cur.DTSTART ? parseDate(cur.DTSTART.value, cur.DTSTART.params) : null;
        if (!start) {
          warnings.push(`Skipped "${cur.SUMMARY?.value ?? "untitled"}" — no usable start date`);
        } else {
          const end = cur.DTEND ? parseDate(cur.DTEND.value, cur.DTEND.params) : null;
          if (cur.RRULE) warnings.push(`"${cur.SUMMARY?.value ?? "untitled"}" repeats — only the first occurrence was imported`);
          events.push({
            uid: cur.UID?.value ?? `${start.date.getTime()}-${cur.SUMMARY?.value ?? ""}`,
            title: unescape(cur.SUMMARY?.value ?? "Untitled"),
            start: start.date,
            end: end?.date,
            allDay: start.allDay,
            description: cur.DESCRIPTION ? unescape(cur.DESCRIPTION.value) : undefined,
            location: cur.LOCATION ? unescape(cur.LOCATION.value) : undefined,
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...paramParts] = head.split(";");
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const [k, v] = p.split("=");
      if (k && v) params[k.toUpperCase()] = v;
    }
    cur[name.toUpperCase()] = { value, params };
  }

  return { events, warnings };
}
