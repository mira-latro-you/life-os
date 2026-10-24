/**
 * Life OS – Ergänzung für den School Hub (Apps Script „SSH – Backend“, ab Version 19).
 * Steht dort am Ende von Code.gs; zusätzlich ist 'lifeosSync' in API_FUNCS eingetragen.
 *
 * Termine aus der Life-OS-App im Google Kalender (Hauptkalender) halten.
 * Aufruf über die JSON-Schnittstelle: { fn: 'lifeosSync', args: [{ upsert: [...], remove: [uid, ...] }] }
 * Ändert und löscht ausschließlich Termine mit LIFEOS_MARK in der Beschreibung.
 * Neue Termine bekommen die Standard-Erinnerungen deines Kalenders.
 */
const LIFEOS_MARK = 'Eingetragen über Life OS';

function lifeosSync_(req) {
  req = req || {};
  const cal = CalendarApp.getDefaultCalendar();
  const out = { upserted: [], removed: [], errors: [] };
  const own = ev => ev && (ev.getDescription() || '').indexOf(LIFEOS_MARK) >= 0;

  (req.remove || []).forEach(uid => {
    try {
      const ev = cal.getEventById(String(uid));
      if (own(ev)) ev.deleteEvent();
      out.removed.push(uid);
    } catch (e) {
      out.errors.push({ uid: uid, error: String((e && e.message) || e) });
    }
  });

  (req.upsert || []).slice(0, 25).forEach(it => {
    try {
      const title = String(it.title || '').trim() || '(Ohne Titel)';
      const desc = [String(it.notes || '').trim(), LIFEOS_MARK].filter(Boolean).join('\n\n');
      let ev = it.uid ? cal.getEventById(String(it.uid)) : null;
      if (ev && !own(ev)) ev = null; // fremde Termine nie anfassen
      if (it.allDay) {
        const sd = lifeosDate_(it.startDate);
        const ed = lifeosDate_(it.endDate);
        if (ev) ev.setAllDayDates(sd, ed);
        else ev = cal.createAllDayEvent(title, sd, ed);
      } else {
        const s = new Date(it.start);
        const e = new Date(it.end);
        if (isNaN(s) || isNaN(e) || e <= s) throw new Error('Ungültige Zeit');
        if (ev) ev.setTime(s, e);
        else ev = cal.createEvent(title, s, e);
      }
      ev.setTitle(title);
      ev.setLocation(String(it.location || ''));
      ev.setDescription(desc);
      out.upserted.push({ ref: it.ref, uid: ev.getId() });
    } catch (e) {
      out.errors.push({ ref: it.ref, error: String((e && e.message) || e) });
    }
  });

  if (out.upserted.length || out.removed.length) {
    try { clearExamCache_(); } catch (e) {}
  }
  return out;
}

function lifeosDate_(s) {
  const p = String(s || '').split('-').map(Number);
  if (p.length !== 3 || !p[0]) throw new Error('Ungültiges Datum');
  return new Date(p[0], p[1] - 1, p[2]);
}
