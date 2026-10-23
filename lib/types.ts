export type EventKind = "event" | "todo";

export interface LifeEvent {
  id: string;
  user_id: string;
  kind: EventKind;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  done: boolean;
  remind_at: string | null;
  source: "manual" | "ai";
  created_at: string;
  updated_at: string;
}

export interface NewsItem {
  id: string;
  title: string;
  topline: string | null;
  url: string;
  date: string;
}
