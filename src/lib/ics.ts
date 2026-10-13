/**
 * Export de l'agenda au format iCalendar (.ics), lisible par Apple Calendrier, Google Agenda et Outlook.
 * Aucune connexion de compte n'est nécessaire : le fichier est ouvert par l'application de calendrier du téléphone.
 */
import type { AgendaItem } from "./types";
import { toHHMM, toMinutes } from "./format";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Heure locale « flottante » (sans fuseau) : l'événement s'affiche à l'heure saisie. */
const local = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

export function agendaToIcs(items: AgendaItem[]): string {
  const now = stamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NEXORA//Assistant personnel//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const a of items) {
    lines.push("BEGIN:VEVENT", `UID:${a.id}@nexora`, `DTSTAMP:${now}`, `SUMMARY:${esc(a.label)}`);
    if (a.start) {
      // Sans heure de fin : 15 min pour un rappel, 1 h sinon (sans dépasser minuit).
      const end = a.end ?? toHHMM(Math.min(23 * 60 + 59, toMinutes(a.start) + (a.kind === "reminder" ? 15 : 60)));
      lines.push(`DTSTART:${local(a.date, a.start)}`, `DTEND:${local(a.date, end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${a.date.replace(/-/g, "")}`);
    }
    if (a.kind === "reminder") lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(a.label)}`, "TRIGGER:PT0M", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
