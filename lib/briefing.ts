import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { berlinHour, dayRange, formatTime, todayKey, formatLongDate } from "./dates";
import { mergeLessons } from "./calendar";
import { getSchoolState } from "./school-hub";
import { getNews } from "./news";
import { habitStatus, SPLIT_LABEL } from "./habits";
import { writeBriefing } from "./gemini";
import { quoteOfDay } from "./quotes";
import type { BriefingContent, Habit, HabitLog, Profile, Task, Workspace } from "./types";

/**
 * Daily AI Briefing: einmal pro Tag erzeugt und in `briefings` gespeichert.
 * Fakten (Termine, Schule, Training, Arbeit, News) werden deterministisch gesammelt,
 * Gemini formuliert nur den Text – so werden keine Termine erfunden.
 */
export async function getOrCreateBriefing(supabase: SupabaseClient, userId: string, force = false): Promise<BriefingContent> {
  const today = todayKey();

  if (!force) {
    const { data } = await supabase.from("briefings").select("content").eq("user_id", userId).eq("briefing_date", today).maybeSingle();
    if (data?.content) return data.content as BriefingContent;
  }

  const { start, end } = dayRange(today);
  const [profileRes, settingsRes, eventsRes, tasksRes, wsRes, habitsRes, logsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_settings").select("show_school").eq("user_id", userId).maybeSingle(),
    supabase.from("events").select("title, starts_at, ends_at, all_day").eq("kind", "event").gte("starts_at", start).lte("starts_at", end).order("starts_at"),
    supabase.from("tasks").select("*").eq("status", "open").limit(500),
    supabase.from("workspaces").select("*"),
    supabase.from("habits").select("*").eq("archived", false),
    supabase.from("habit_logs").select("*").gte("log_date", new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  const profile = (profileRes.data ?? {}) as Partial<Profile>;
  const tasks = (tasksRes.data ?? []) as Task[];
  const workspaces = (wsRes.data ?? []) as Workspace[];
  const habits = (habitsRes.data ?? []) as Habit[];
  const logs = (logsRes.data ?? []) as HabitLog[];
  const wsKey = (id: string | null) => workspaces.find((w) => w.id === id)?.key;

  // Schule heute
  const school = await getSchoolState(supabase, userId, Boolean(settingsRes.data?.show_school));
  const lessons = school.state === "ok" ? mergeLessons(school.snapshot.lessons.filter((l) => l.datum === today)) : [];
  const realLessons = lessons.filter((l) => !/entf|ausfall/i.test(l.status));
  const schoolToday = realLessons.length
    ? `Berufsschule ${realLessons[0].start}–${realLessons[realLessons.length - 1].ende} (${[...new Set(realLessons.map((l) => l.fach))].join(", ")})`
    : null;

  // Tagesplan
  const schedule: string[] = [];
  if (schoolToday) schedule.push(schoolToday);
  for (const e of eventsRes.data ?? []) {
    schedule.push(e.all_day ? `${e.title} (ganztägig)` : `${formatTime(e.starts_at)} ${e.title}`);
  }
  for (const t of tasks) {
    if (t.scheduled_start && t.scheduled_start >= start && t.scheduled_start <= end) schedule.push(`${formatTime(t.scheduled_start)} ${t.title}`);
  }

  // Training
  const ppl = habits.find((h) => h.kind === "ppl");
  let training = "Kein Trainingsplan hinterlegt.";
  if (ppl) {
    const st = habitStatus(ppl, logs, today);
    training = st.doneToday
      ? "Training heute schon erledigt."
      : st.restRecommended
        ? `Rest Day nach ${st.run} Trainingstagen am Stück.`
        : `${SPLIT_LABEL[st.next ?? "push"] ?? st.next}-Training steht an (Streak: ${st.streak} Tage).`;
  }

  // Arbeit
  const work = tasks.filter((t) => wsKey(t.workspace_id) === "arbeit");
  const openWork = [...work.filter((t) => t.type === "question"), ...work.filter((t) => t.type === "goal"), ...work.filter((t) => t.type === "task")]
    .slice(0, 5)
    .map((t) => `${t.type === "question" ? "Frage" : t.type === "goal" ? "Ziel" : "Aufgabe"}: ${t.title}`);
  const dueToday = tasks.filter((t) => t.due_at && t.due_at <= end).slice(0, 5).map((t) => t.title);

  // Positive Wirtschafts-News
  let news: BriefingContent["news"] = [];
  try {
    const all = await getNews(supabase, userId);
    const good = all.filter((n) => n.positive);
    const econ = good.filter((n) => n.category === "wirtschaft" || n.category === "ecommerce");
    news = [...econ, ...good.filter((n) => !econ.includes(n))].slice(0, 3).map((n) => ({ title: n.title, url: n.url, source: n.source }));
  } catch (err) {
    console.error("[briefing] news", err);
  }

  const name = profile.display_name || "Justus";
  const hour = berlinHour();
  const facts = {
    name,
    weekday: formatLongDate(),
    schoolToday,
    schedule,
    training,
    workFocus: profile.work_focus || "",
    openWork,
    dueToday,
  };

  let text = {
    greeting: `${hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend"}, ${name}!`,
    summary: schedule.length ? `Heute: ${schedule.slice(0, 3).join(", ")}.` : "Heute ist nichts Festes geplant – Raum für deine Projekte.",
    training,
    workFocus: profile.work_focus ? `Fokus bei der Arbeit: ${profile.work_focus}.` : openWork[0] ?? "",
  };
  let ai = false;
  try {
    const out = await writeBriefing(facts);
    if (out.greeting && out.summary) {
      text = {
        greeting: out.greeting.slice(0, 80),
        summary: out.summary.slice(0, 400),
        training: (out.training || training).slice(0, 200),
        workFocus: (out.workFocus || text.workFocus).slice(0, 240),
      };
      ai = true;
    }
  } catch (err) {
    console.error("[briefing] gemini", err);
  }

  const content: BriefingContent = {
    ...text,
    schedule,
    news,
    quote: quoteOfDay(today),
    generatedAt: new Date().toISOString(),
    ai,
  };
  await supabase.from("briefings").upsert({ user_id: userId, briefing_date: today, content }, { onConflict: "user_id,briefing_date" });
  return content;
}
