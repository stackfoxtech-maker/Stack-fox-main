import { Bell, Check, Home, Search, ShoppingBag, Star, User } from 'lucide-react';

/* Coded previews of what each build looks like when it ships. Product UI, not photos. */

function Browser({ url, children }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_30px_60px_-24px_rgba(90,30,0,0.45)] ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-warm-100 bg-warm-50 px-3 py-2">
        <div className="flex gap-1" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-warm-200" />
          <span className="h-2 w-2 rounded-full bg-warm-200" />
          <span className="h-2 w-2 rounded-full bg-warm-200" />
        </div>
        <div className="mx-auto rounded bg-white px-2.5 py-0.5 font-mono text-[10px] text-warm-700 ring-1 ring-warm-100">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

function Website() {
  return (
    <Browser url="mehtabakery.in">
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-center justify-between text-[11px] text-warm-800">
          <span className="font-display text-sm font-bold text-warm-900">Mehta Bakery</span>
          <span className="hidden gap-4 sm:flex">
            <span>Menu</span>
            <span>Catering</span>
            <span>Visit us</span>
          </span>
          <span className="rounded-pill bg-warm-900 px-2.5 py-1 text-[10px] font-semibold text-white">
            Order now
          </span>
        </div>
        <div className="mt-6 grid items-center gap-4 sm:grid-cols-2">
          <div>
            <p className="font-display text-2xl font-bold leading-tight text-warm-900">
              Baked fresh every morning in Pune.
            </p>
            <p className="mt-2 text-[11px] text-warm-700">
              Cakes, breads and catering for 10 to 500 guests.
            </p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-pill bg-fox-500 px-3 py-1.5 text-[10px] font-semibold text-white">
                See the menu
              </span>
              <span className="rounded-pill px-3 py-1.5 text-[10px] font-semibold text-warm-700 ring-1 ring-warm-200">
                Book catering
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2" aria-hidden>
            <div className="aspect-square rounded-lg bg-gradient-to-br from-[#f3d3b0] to-[#d99a62]" />
            <div className="aspect-square rounded-lg bg-gradient-to-br from-[#efe2d0] to-[#c9a882]" />
            <div className="col-span-2 h-10 rounded-lg bg-gradient-to-r from-[#f7e7d5] to-[#e8c39c]" />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-lg bg-warm-50 px-3 py-2 text-[10px] text-warm-800">
          <Star size={12} className="fill-fox-500 text-fox-500" />
          Ranked #1 for “bakery near me” in Kothrud
        </div>
      </div>
    </Browser>
  );
}

function Store() {
  const products = [
    ['Cold-pressed groundnut oil', '₹420', 'from-[#f6e3b4] to-[#d9b45f]'],
    ['Organic jaggery, 1 kg', '₹180', 'from-[#e8c9a7] to-[#a8703f]'],
    ['Millet flour mix', '₹260', 'from-[#ece6d6] to-[#c2b393]'],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
      <Browser url="greenleaf.store">
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 rounded-md bg-warm-50 px-2.5 py-1.5 text-[10px] text-warm-700">
            <Search size={11} /> Search the pantry
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {products.map(([n, p, g]) => (
              <div key={n}>
                <div className={`aspect-[4/5] rounded-lg bg-gradient-to-br ${g}`} aria-hidden />
                <p className="mt-1.5 line-clamp-2 text-[10px] leading-tight text-warm-700">{n}</p>
                <p className="text-[11px] font-semibold text-warm-900">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </Browser>
      <div className="hidden flex-col rounded-xl bg-white p-3 shadow-[0_30px_60px_-24px_rgba(90,30,0,0.45)] sm:flex">
        <p className="text-[11px] font-semibold text-warm-900">Checkout</p>
        <div className="mt-2 space-y-1.5 text-[10px] text-warm-800">
          <div className="flex justify-between">
            <span>3 items</span>
            <span>₹860</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>Free</span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {['UPI', 'Card', 'Cash on delivery'].map((m, i) => (
            <div
              key={m}
              className={`rounded-md px-2 py-1.5 text-[10px] ${i === 0 ? 'bg-fox-50 font-semibold text-warm-900 ring-1 ring-fox-300' : 'text-warm-700 ring-1 ring-warm-100'}`}
            >
              {m}
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-1.5 rounded-md bg-sage-50 px-2 py-1.5 text-[10px] font-semibold text-sage-700">
          <Check size={11} /> Paid ₹860 via UPI
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="flex items-end justify-center gap-5">
      <div className="relative w-[13.5rem] rounded-[2rem] bg-warm-900 p-2 shadow-[0_30px_60px_-24px_rgba(90,30,0,0.55)]">
        <div className="overflow-hidden rounded-[1.6rem] bg-warm-white">
          <div className="flex justify-between px-4 pt-2.5 text-[9px] font-semibold text-warm-800">
            <span>9:41</span>
            <span>5G</span>
          </div>
          <div className="px-4 pb-3 pt-3">
            <p className="text-[10px] text-warm-700">Good morning, Aarav</p>
            <p className="font-display text-base font-bold text-warm-900">Today&apos;s classes</p>
            <div className="mt-3 space-y-2">
              {[
                ['Physics · Motion', '10:00', 'bg-fox-500'],
                ['Maths · Integrals', '12:30', 'bg-sage-500'],
                ['Chemistry lab', '15:00', 'bg-[#3e7cb1]'],
              ].map(([t, h, c]) => (
                <div
                  key={t}
                  className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-sm"
                >
                  <span className={`h-7 w-1 rounded-full ${c}`} />
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-warm-900">{t}</p>
                    <p className="text-[9px] text-warm-700">Live · {h}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-warm-900 p-2.5 text-white">
              <p className="text-[9px] text-warm-300">Weekly streak</p>
              <p className="text-sm font-bold">6 of 7 days</p>
            </div>
          </div>
          <div
            className="flex justify-around border-t border-warm-100 bg-white py-2 text-warm-600"
            aria-hidden
          >
            <Home size={14} className="text-fox-500" />
            <Search size={14} />
            <ShoppingBag size={14} />
            <User size={14} />
          </div>
        </div>
      </div>
      <div className="mb-10 hidden w-44 rounded-xl bg-white/95 p-3 shadow-lg sm:block">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-warm-900">
          <Bell size={12} className="text-fox-500" /> Push notification
        </div>
        <p className="mt-1 text-[10px] leading-snug text-warm-800">
          Physics starts in 10 minutes. Tap to join.
        </p>
      </div>
    </div>
  );
}

function Assistant() {
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-xl bg-white shadow-[0_30px_60px_-24px_rgba(90,30,0,0.45)]">
      <div className="flex items-center gap-2 bg-warm-900 px-4 py-3 text-white">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-fox-500 text-[11px] font-bold">
          HF
        </span>
        <div>
          <p className="text-[11px] font-semibold">HealthFirst assistant</p>
          <p className="text-[9px] text-warm-300">Answers from your clinic&apos;s own documents</p>
        </div>
      </div>
      <div className="space-y-2.5 bg-warm-white p-4 text-[11px]">
        <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-warm-900 px-3 py-2 text-white">
          Is Dr. Iyer available on Saturday?
        </p>
        <div className="w-fit max-w-[90%] rounded-lg rounded-bl-sm bg-white px-3 py-2 text-warm-800 shadow-sm">
          Yes, Dr. Iyer sees patients on Saturday from 10am to 1pm. Two slots are left.
          <div className="mt-2 flex gap-1.5">
            {['10:40', '12:20'].map((t) => (
              <span
                key={t}
                className="rounded-pill px-2 py-0.5 text-[10px] font-semibold text-fox-600 ring-1 ring-fox-300"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <p className="ml-auto w-fit rounded-lg rounded-br-sm bg-warm-900 px-3 py-2 text-white">
          12:20 please
        </p>
        <p className="flex w-fit items-center gap-1.5 rounded-lg bg-sage-50 px-3 py-2 font-medium text-sage-700">
          <Check size={12} /> Booked. Reminder sent on WhatsApp.
        </p>
      </div>
    </div>
  );
}

function Growth() {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-5 shadow-[0_30px_60px_-24px_rgba(90,30,0,0.45)]">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold text-warm-900">Organic visitors</p>
        <p className="text-[10px] text-warm-700">Last 6 months</p>
      </div>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-warm-900">
        18,420 <span className="text-sm font-semibold text-sage-600">+212%</span>
      </p>
      <svg viewBox="0 0 300 110" className="mt-3 w-full" aria-hidden>
        <defs>
          <linearGradient id="gr-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff4d00" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ff4d00" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 50, 80].map((y) => (
          <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#edeae4" strokeWidth="1" />
        ))}
        <path
          d="M0 96 L50 90 L100 84 L150 70 L200 52 L250 34 L300 14 L300 110 L0 110 Z"
          fill="url(#gr-fill)"
        />
        <path
          d="M0 96 L50 90 L100 84 L150 70 L200 52 L250 34 L300 14"
          fill="none"
          stroke="#ff4d00"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-warm-100 pt-3 text-[10px]">
        {[
          ['Top-3 keywords', '41'],
          ['Enquiries / month', '96'],
          ['Conversion', '3.8%'],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-warm-700">{k}</p>
            <p className="text-sm font-bold tabular-nums text-warm-900">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PREVIEWS = { website: Website, store: Store, app: App, ai: Assistant, growth: Growth };

export function BuildPreview({ kind }) {
  const Preview = PREVIEWS[kind] || Website;
  return <Preview />;
}
