import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Handshake, ArrowRight, Calendar, Users, ChevronRight } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatDate, getStatusBadge } from '@lib/utils';
import { Spinner, Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';

export default function Engagements() {
  usePageTitle('Engagements');
  const { id } = useParams();
  const [engagements, setEngagements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/engagements').then(r => {
      setEngagements(r.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (id) {
      api.get(`/engagements/${id}`).then(r => setSelected(r.data.data)).catch(() => {});
    }
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  if (id && selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-warm-500">
          <Link to="/app/client/engagements" className="hover:text-fox-500">Engagements</Link>
          <ChevronRight size={14} />
          <span className="text-warm-900">{selected.model} – {selected.id}</span>
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-warm-900">{selected.model} Engagement</h2>
            <Badge variant={selected.status === 'ACTIVE' ? 'success' : 'neutral'}>{selected.status}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-warm-500">Model</span><p className="font-medium">{selected.model}</p></div>
            <div><span className="text-warm-500">Methodology</span><p className="font-medium">{selected.methodology}</p></div>
            <div><span className="text-warm-500">Start</span><p className="font-medium">{formatDate(selected.createdAt)}</p></div>
            <div><span className="text-warm-500">End</span><p className="font-medium">{selected.endsAt ? formatDate(selected.endsAt) : '–'}</p></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-warm-900">Engagements</h1>
      </div>

      {engagements.length === 0 ? (
        <EmptyState icon={Handshake} title="No engagements yet" description="Your active engagements will appear here once a project is contracted." />
      ) : (
        <div className="space-y-3">
          {engagements.map(eng => (
            <Link key={eng.id} to={`/app/client/engagements/${eng.id}`}
              className="bg-white rounded-2xl border border-warm-200 p-5 flex items-center justify-between hover:shadow-card transition-shadow group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-fox-50 text-fox-600 flex items-center justify-center">
                  <Handshake size={20} />
                </div>
                <div>
                  <p className="font-medium text-warm-900">{eng.model} – {eng.methodology}</p>
                  <p className="text-sm text-warm-500">{eng.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={eng.status === 'ACTIVE' ? 'success' : 'neutral'}>{eng.status}</Badge>
                <ArrowRight size={16} className="text-warm-300 group-hover:text-fox-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
