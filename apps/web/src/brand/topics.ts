/** Icon and colour for a quiz card, picked from keywords in its title. */
export interface QuizTheme {
  icon: string;
  /** Tailwind gradient classes for the card cover. */
  gradient: string;
}

// First match wins, so specific topics come before broad ones ("мэдээллийн аюулгүй ажиллагаа" is security, not safety).
const THEMES: { match: RegExp; theme: QuizTheme }[] = [
  // Library quizzes (general knowledge, Mongolia, insurance, fun).
  { match: /газар зүй/i, theme: { icon: '🌍', gradient: 'from-sky-400 via-blue-500 to-indigo-600' } },
  { match: /сансар|шинжлэх ухаан/i, theme: { icon: '🔭', gradient: 'from-indigo-500 via-violet-600 to-fuchsia-600' } },
  { match: /амьтан/i, theme: { icon: '🦒', gradient: 'from-lime-400 via-green-500 to-emerald-700' } },
  { match: /монголын түүх/i, theme: { icon: '🏹', gradient: 'from-amber-500 via-orange-600 to-red-700' } },
  { match: /түүх|нээлт/i, theme: { icon: '📜', gradient: 'from-amber-300 via-yellow-600 to-orange-800' } },
  { match: /соёл|хоол/i, theme: { icon: '🍜', gradient: 'from-rose-400 via-pink-500 to-fuchsia-600' } },
  { match: /спорт/i, theme: { icon: '⚽', gradient: 'from-emerald-400 via-teal-500 to-cyan-700' } },
  { match: /байгаль/i, theme: { icon: '🏔️', gradient: 'from-cyan-400 via-sky-500 to-blue-700' } },
  { match: /наадам|ёс заншил/i, theme: { icon: '🐎', gradient: 'from-sky-500 via-blue-600 to-brand-500' } },
  { match: /монгол хэл|зүйр/i, theme: { icon: '📖', gradient: 'from-teal-400 via-cyan-600 to-indigo-700' } },
  { match: /технологи ба интерн/i, theme: { icon: '📱', gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700' } },
  { match: /ерөнхий мэдлэг/i, theme: { icon: '🧠', gradient: 'from-violet-500 via-indigo-500 to-sky-500' } },
  { match: /сонин хачин/i, theme: { icon: '🤯', gradient: 'from-yellow-400 via-orange-500 to-pink-600' } },
  { match: /домог/i, theme: { icon: '🧐', gradient: 'from-purple-500 via-fuchsia-500 to-rose-500' } },
  { match: /логик|оньсого/i, theme: { icon: '🧩', gradient: 'from-emerald-400 via-cyan-500 to-blue-600' } },
  { match: /өдөр тутмын даатгал|эрсдэлээ мэдье/i, theme: { icon: '🏠', gradient: 'from-orange-400 via-brand-500 to-rose-600' } },
  { match: /даатгалын салбар/i, theme: { icon: '🏛️', gradient: 'from-slate-500 via-blue-600 to-brand-500' } },
  { match: /даатгал/i, theme: { icon: '☂️', gradient: 'from-brand-400 via-orange-500 to-amber-600' } },
  // Agula company quizzes.
  { match: /хандах эрх|нууц үг/i, theme: { icon: '🔑', gradient: 'from-amber-400 via-orange-500 to-rose-600' } },
  { match: /зөрчил/i, theme: { icon: '🚨', gradient: 'from-rose-500 via-red-600 to-purple-700' } },
  { match: /хөрөнгө|хөгжүүлэлт/i, theme: { icon: '💻', gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700' } },
  { match: /ажилтны мэдээллийн/i, theme: { icon: '🔒', gradient: 'from-sky-500 via-cyan-600 to-teal-700' } },
  { match: /мэдээлл/i, theme: { icon: '🔐', gradient: 'from-blue-500 via-indigo-600 to-violet-700' } },
  { match: /санхүү|нягтлан/i, theme: { icon: '💰', gradient: 'from-emerald-400 via-green-500 to-teal-700' } },
  // Not inside words like «даатгал».
  { match: /(^|[\s·])гал/i, theme: { icon: '🔥', gradient: 'from-orange-500 via-red-500 to-rose-600' } },
  { match: /цахилгаан/i, theme: { icon: '⚡', gradient: 'from-yellow-400 via-amber-500 to-orange-600' } },
  { match: /эрүүл|аюулгүй ажиллагаа/i, theme: { icon: '⛑️', gradient: 'from-lime-500 via-emerald-500 to-teal-600' } },
  { match: /ёс зүй|сахилг/i, theme: { icon: '⚖️', gradient: 'from-indigo-500 via-violet-500 to-fuchsia-600' } },
  { match: /харилцагч|үйлчилгээ|маркетинг/i, theme: { icon: '🤝', gradient: 'from-pink-500 via-rose-500 to-orange-500' } },
  { match: /хөдөлмөр/i, theme: { icon: '💼', gradient: 'from-sky-500 via-blue-600 to-indigo-700' } },
  { match: /нөхөн төлбөр|claim/i, theme: { icon: '🛡️', gradient: 'from-brand-400 via-brand-500 to-brand-700' } },
  { match: /гүйцэтгэл|kpi/i, theme: { icon: '🎯', gradient: 'from-emerald-500 via-teal-500 to-cyan-600' } },
  { match: /эрсдэл|комплайнс/i, theme: { icon: '📊', gradient: 'from-violet-500 via-purple-600 to-indigo-700' } },
  { match: /архив|албан хэрэг/i, theme: { icon: '🗂️', gradient: 'from-stone-400 via-amber-600 to-orange-800' } },
  { match: /aisys|тикет|дош/i, theme: { icon: '🎫', gradient: 'from-cyan-400 via-sky-500 to-blue-700' } },
  { match: /систем|архитектур/i, theme: { icon: '🧩', gradient: 'from-slate-500 via-indigo-600 to-violet-700' } },
  { match: /нөөцлөлт|тасралтгүй/i, theme: { icon: '💾', gradient: 'from-teal-400 via-cyan-600 to-blue-700' } },
  { match: /программ|код|өөрчлөлт|дэд бүтэц|технолог/i, theme: { icon: '💻', gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700' } },
];

const FALLBACK: QuizTheme[] = [
  { icon: '✨', gradient: 'from-brand-400 via-orange-500 to-pink-500' },
  { icon: '🧠', gradient: 'from-violet-500 via-indigo-500 to-sky-500' },
  { icon: '🚀', gradient: 'from-pink-500 via-rose-500 to-brand-500' },
  { icon: '🎲', gradient: 'from-emerald-500 via-teal-500 to-sky-600' },
];

export function quizTheme(title: string): QuizTheme {
  const found = THEMES.find((t) => t.match.test(title));
  if (found) return found.theme;
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK[Math.abs(hash) % FALLBACK.length]!;
}

/** Title without the "Agula · " prefix, for compact cards. */
export function shortTitle(title: string): string {
  return title.replace(/^agula\s*[·:|-]\s*/i, '');
}
