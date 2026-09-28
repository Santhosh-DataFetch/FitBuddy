import { ArrowRight, Check, ChevronRight, Sparkles, Timer, TrendingUp, Play, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";
import { Link } from "wouter";

const previewDays = [
  { label: "MON", title: "Strength foundation", meta: "35 min · Medium", active: true },
  { label: "TUE", title: "Recovery reset", meta: "20 min · Low", active: false },
  { label: "WED", title: "Cardio base", meta: "30 min · Easy", active: false },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#0b0d0c] text-[#edf2ee]">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="FitBuddy home">
          <span className="grid size-9 place-items-center rounded-[12px] bg-[#d9f75f] text-[#10120d] shadow-[0_0_30px_rgba(217,247,95,.2)]"><Sparkles size={17} strokeWidth={2.5} /></span>
          <span className="text-[15px] font-semibold tracking-[-0.02em]">fitbuddy<span className="text-[#d9f75f]">.</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[#a2aaa2] md:flex">
          <a href="#how-it-works" className="transition hover:text-white">How it works</a>
          <a href="#principles" className="transition hover:text-white">Built for real life</a>
          <button onClick={startLogin} className="rounded-full border border-white/10 px-4 py-2 font-medium text-[#e4e9e4] transition hover:border-white/20 hover:bg-white/5">Sign in</button>
        </nav>
        <button onClick={startLogin} className="rounded-full bg-[#d9f75f] px-4 py-2 text-sm font-semibold text-[#11140d] transition hover:bg-[#e6fb8a] md:hidden">Get started</button>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-10 lg:pb-32 lg:pt-20">
          <div className="pointer-events-none absolute -left-32 top-0 size-[520px] rounded-full bg-[#d9f75f]/[.06] blur-[110px]" />
          <div className="relative">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d9f75f]/20 bg-[#d9f75f]/[.06] px-3 py-1.5 text-xs font-medium text-[#d9f75f]"><span className="size-1.5 rounded-full bg-[#d9f75f]" /> A calmer way to get consistent</div>
            <h1 className="max-w-2xl text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-[.91] tracking-[-.075em] text-[#f3f6f0]">Your plan.<br /><span className="text-[#a8b0a8]">Built around</span><br />you<span className="text-[#d9f75f]">.</span></h1>
            <p className="mt-8 max-w-lg text-lg leading-8 text-[#a2aaa2]">FitBuddy turns your goals, preferences, and schedule into a practical fitness week you can actually follow.</p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button onClick={startLogin} className="group inline-flex h-12 items-center gap-3 rounded-full bg-[#d9f75f] px-6 text-sm font-semibold text-[#11140d] transition hover:bg-[#e6fb8a]">Create my plan <ArrowRight size={17} className="transition group-hover:translate-x-0.5" /></button>
              <a href="#how-it-works" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-medium text-[#d7ddd7] transition hover:border-white/20 hover:bg-white/5">Explore FitBuddy <Play size={14} fill="currentColor" /></a>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-xs text-[#7f8a80]"><span className="inline-flex items-center gap-2"><Check size={14} className="text-[#d9f75f]" /> No judgment, ever</span><span className="inline-flex items-center gap-2"><Check size={14} className="text-[#d9f75f]" /> Adapts as you go</span><span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-[#d9f75f]" /> Privacy-minded</span></div>
          </div>

          <div className="relative lg:pl-8">
            <div className="absolute -inset-5 rounded-[40px] bg-[#d9f75f]/[.04] blur-2xl" />
            <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#151916] p-3 shadow-2xl shadow-black/30">
              <div className="rounded-[22px] border border-white/[.06] bg-[#0f120f] p-5 sm:p-7">
                <div className="mb-8 flex items-center justify-between"><div><div className="text-[11px] uppercase tracking-[.18em] text-[#7d887e]">Monday, October 7</div><div className="mt-2 text-2xl font-semibold tracking-[-.04em]">Good morning, Alex<span className="text-[#d9f75f]">.</span></div></div><div className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-sm">AK</div></div>
                <div className="mb-3 flex items-end justify-between"><div><div className="text-xs font-medium uppercase tracking-[.16em] text-[#d9f75f]">Today’s focus</div><h2 className="mt-2 text-3xl font-semibold tracking-[-.05em]">Strength foundation</h2></div><div className="text-right text-xs text-[#8c978e]"><div className="flex items-center gap-1.5"><Timer size={14} /> 35 min</div><div className="mt-1">Medium</div></div></div>
                <div className="mt-6 grid gap-2">{["Bodyweight squat", "Incline push-up", "Resistance band row"].map((item, index) => <div key={item} className="flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.025] px-4 py-3.5"><div className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-lg bg-[#d9f75f]/10 text-xs font-semibold text-[#d9f75f]">0{index + 1}</span><span className="text-sm text-[#dce2dc]">{item}</span></div><span className="text-xs text-[#7e897f]">{index === 2 ? "3 × 10" : "3 × 8"}</span></div>)}</div>
                <button onClick={startLogin} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#d9f75f] text-sm font-semibold text-[#11140d]">Start workout <ArrowRight size={15} /></button>
                <div className="mt-6 border-t border-white/[.07] pt-5"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-[#aab4ab]">Your week</span><span className="text-xs text-[#778278]">2 of 4 sessions</span></div><div className="flex gap-2">{previewDays.map(day => <div key={day.label} className={`flex-1 rounded-xl border p-3 ${day.active ? "border-[#d9f75f]/30 bg-[#d9f75f]/[.08]" : "border-white/[.06] bg-white/[.02]"}`}><div className="text-[10px] font-semibold tracking-[.15em] text-[#829083]">{day.label}</div><div className="mt-2 line-clamp-1 text-xs font-medium text-[#dbe1db]">{day.title}</div><div className="mt-1 text-[10px] text-[#7e897f]">{day.meta}</div></div>)}</div></div>
              </div>
            </div>
            <div className="absolute -right-2 top-20 hidden items-center gap-3 rounded-2xl border border-white/10 bg-[#1b201b] px-4 py-3 shadow-xl sm:flex"><div className="grid size-8 place-items-center rounded-full bg-[#d9f75f]/15 text-[#d9f75f]"><TrendingUp size={16} /></div><div><div className="text-xs font-semibold text-[#ecf0eb]">Plan adapted</div><div className="mt-0.5 text-[10px] text-[#879288]">You asked for shorter sessions</div></div></div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/[.07] bg-[#101310] px-6 py-24 lg:px-10"><div className="mx-auto max-w-7xl"><div className="max-w-xl"><div className="text-xs font-semibold uppercase tracking-[.18em] text-[#d9f75f]">A simple loop</div><h2 className="mt-4 text-4xl font-semibold tracking-[-.06em] sm:text-5xl">Less guessing.<br />More doing.</h2></div><div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/[.08] bg-white/[.08] md:grid-cols-3">{[{ n:"01", title:"Tell us what fits", copy:"Your goals, experience, equipment, and the time you actually have." },{ n:"02", title:"Get your week", copy:"A clear plan with a reason behind every session — and space to recover." },{ n:"03", title:"Keep adjusting", copy:"Log how it felt. Ask for changes. FitBuddy learns without starting over." }].map(step => <div key={step.n} className="bg-[#101310] p-7 sm:p-9"><div className="text-xs font-semibold text-[#d9f75f]">{step.n}</div><h3 className="mt-14 text-xl font-semibold tracking-[-.03em]">{step.title}</h3><p className="mt-3 text-sm leading-6 text-[#8e998f]">{step.copy}</p><ChevronRight className="mt-8 text-[#4b574c]" size={20} /></div>)}</div></div></section>

        <section id="principles" className="mx-auto grid max-w-7xl gap-14 px-6 py-24 lg:grid-cols-[.8fr_1.2fr] lg:px-10 lg:py-32"><div><div className="text-xs font-semibold uppercase tracking-[.18em] text-[#d9f75f]">Designed for real life</div><h2 className="mt-4 max-w-md text-4xl font-semibold tracking-[-.06em] sm:text-5xl">Consistency is a product decision.</h2></div><div className="grid gap-10 sm:grid-cols-2">{[{title:"Practical by default",copy:"Sessions are shaped around your time, your space, and your energy — not an idealized version of you."},{title:"Supportive, not loud",copy:"Clear next steps and useful feedback, without shame, streak anxiety, or exaggerated promises."},{title:"Built to adapt",copy:"A shorter session or missed day is information. Change the minimum necessary and keep moving."},{title:"Your data stays yours",copy:"Your profile and plan are protected behind authenticated access and purposeful storage."}].map(item => <div key={item.title} className="border-t border-white/10 pt-5"><h3 className="text-base font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#8e998f]">{item.copy}</p></div>)}</div></section>
      </main>
      <footer className="border-t border-white/[.07] px-6 py-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-[#748075] sm:flex-row sm:items-center sm:justify-between"><span>fitbuddy<span className="text-[#d9f75f]">.</span> · Your next good decision</span><span>General wellness guidance, not medical advice.</span></div></footer>
    </div>
  );
}
