/**
 * Zitat des Tages – kuratierte, gesicherte Zitate (keine KI, damit nichts falsch zugeordnet wird).
 * Pro Kalendertag deterministisch ausgewählt.
 */
export const QUOTES: { text: string; author: string }[] = [
  { text: "Es ist nicht wenig Zeit, die wir haben, sondern es ist viel Zeit, die wir nicht nutzen.", author: "Seneca" },
  { text: "Glück ist das einzige, was sich verdoppelt, wenn man es teilt.", author: "Albert Schweitzer (zugeschrieben)" },
  { text: "Wer immer tut, was er schon kann, bleibt immer das, was er schon ist.", author: "Henry Ford (zugeschrieben)" },
  { text: "Es ist nicht genug, zu wissen, man muss auch anwenden; es ist nicht genug, zu wollen, man muss auch tun.", author: "Johann Wolfgang von Goethe" },
  { text: "Die Zukunft hängt davon ab, was wir heute tun.", author: "Mahatma Gandhi (zugeschrieben)" },
  { text: "Wir sind, was wir wiederholt tun. Vortrefflichkeit ist daher keine Handlung, sondern eine Gewohnheit.", author: "Will Durant über Aristoteles" },
  { text: "Phantasie ist wichtiger als Wissen, denn Wissen ist begrenzt.", author: "Albert Einstein" },
  { text: "Nicht weil es schwer ist, wagen wir es nicht, sondern weil wir es nicht wagen, ist es schwer.", author: "Seneca" },
  { text: "Das Glück deines Lebens hängt von der Beschaffenheit deiner Gedanken ab.", author: "Marc Aurel" },
  { text: "Auch aus Steinen, die einem in den Weg gelegt werden, kann man Schönes bauen.", author: "Johann Wolfgang von Goethe (zugeschrieben)" },
  { text: "Man muss das Unmögliche versuchen, um das Mögliche zu erreichen.", author: "Hermann Hesse" },
  { text: "Der Weg ist das Ziel.", author: "Konfuzius (zugeschrieben)" },
  { text: "Es ist egal, wie langsam du gehst, solange du nicht stehen bleibst.", author: "Konfuzius (zugeschrieben)" },
  { text: "Wer fragt, ist ein Narr für eine Minute. Wer nicht fragt, ist ein Narr sein Leben lang.", author: "Konfuzius (zugeschrieben)" },
  { text: "Fange nie an aufzuhören, höre nie auf anzufangen.", author: "Marcus Tullius Cicero (zugeschrieben)" },
  { text: "Das Geheimnis des Vorwärtskommens besteht darin, den ersten Schritt zu tun.", author: "Mark Twain (zugeschrieben)" },
  { text: "In zwanzig Jahren wirst du mehr enttäuscht sein über die Dinge, die du nicht getan hast, als über die, die du getan hast.", author: "Mark Twain (zugeschrieben)" },
  { text: "Erfolg ist nicht endgültig, Misserfolg ist nicht fatal: Was zählt, ist der Mut weiterzumachen.", author: "Winston Churchill (zugeschrieben)" },
  { text: "Ordnung ist das halbe Leben.", author: "Sprichwort" },
  { text: "Übung macht den Meister.", author: "Sprichwort" },
  { text: "Die einzige Konstante im Universum ist die Veränderung.", author: "Heraklit" },
  { text: "Wer die Gegenwart genießt, hat in Zukunft eine wundervolle Vergangenheit.", author: "Unbekannt" },
  { text: "Beginne dort, wo du bist. Nutze, was du hast. Tu, was du kannst.", author: "Arthur Ashe" },
  { text: "Disziplin ist die Brücke zwischen Zielen und Erfolg.", author: "Jim Rohn" },
  { text: "Kleine Taten, die man ausführt, sind besser als große, die man plant.", author: "Unbekannt" },
  { text: "Was du heute kannst besorgen, das verschiebe nicht auf morgen.", author: "Sprichwort" },
  { text: "Nichts in der Welt ist so mächtig wie eine Idee, deren Zeit gekommen ist.", author: "Victor Hugo (sinngemäß)" },
  { text: "Lerne von gestern, lebe für heute, hoffe auf morgen.", author: "Albert Einstein (zugeschrieben)" },
  { text: "Wer kämpft, kann verlieren. Wer nicht kämpft, hat schon verloren.", author: "Bertolt Brecht (zugeschrieben)" },
];

export function quoteOfDay(day: string) {
  let hash = 0;
  for (const c of day) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return QUOTES[hash % QUOTES.length];
}
