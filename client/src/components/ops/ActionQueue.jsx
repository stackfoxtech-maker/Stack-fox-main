import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing } from 'lucide-react';
import api from '@lib/api';

/**
 * "Needs your attention" for staff: one list of what is waiting on this person
 * (milestones to approve, change requests to price, contracts to countersign,
 * projects to hand over, cash to confirm...). Built by GET /ops/queue, scoped to
 * the signed-in role. Renders nothing when there is nothing, or if it cannot load,
 * so it can never get in the way of the dashboard it sits on.
 */
export default function ActionQueue() {
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    api
      .get('/ops/queue')
      .then((r) => setQueue(r.data.data))
      .catch(() => {});
  }, []);

  if (!queue || queue.sections.length === 0) return null;

  return (
    <section
      aria-label="Needs your attention"
      className="bg-white rounded-2xl border border-fox-200 p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <BellRing size={18} className="text-fox-500" />
        <h3 className="font-semibold text-warm-900">Needs your attention</h3>
        <span className="ml-1 rounded-full bg-fox-500 px-2 py-0.5 text-xs font-bold text-white">
          {queue.total}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {queue.sections.map((s) => (
          <div key={s.key} className="rounded-xl bg-warm-50 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-warm-900">{s.title}</p>
              <span className="text-sm font-bold tabular-nums text-fox-600">{s.count}</span>
            </div>
            <p className="mt-0.5 text-xs text-warm-500">{s.hint}</p>
            <ul className="mt-3 space-y-1">
              {s.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.link}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-warm-800 hover:bg-white"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                      {item.sub && <span className="ml-2 text-xs text-warm-400">{item.sub}</span>}
                    </span>
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-warm-300 group-hover:text-fox-500"
                    />
                  </Link>
                </li>
              ))}
              {s.count > s.items.length && (
                <li className="px-2 text-xs text-warm-400">and {s.count - s.items.length} more</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
