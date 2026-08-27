import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, UserPlus, Mic, Phone, Calendar, FileText, TrendingUp, Target, Award, XCircle, BarChart3, Plus, ArrowRight, BookOpen } from 'lucide-react';

const kpis = [
  { label: 'Total Leads', value: '48', icon: Users, color: 'text-info-500' },
  { label: 'New Leads', value: '12', icon: UserPlus, color: 'text-success-500' },
  { label: 'Follow-ups Today', value: '5', icon: Calendar, color: 'text-warning-500' },
  { label: 'Meetings Today', value: '3', icon: Phone, color: 'text-fox-500' },
  { label: 'Deals in Progress', value: '8', icon: TrendingUp, color: 'text-info-500' },
  { label: 'Deals Won', value: '15', icon: Award, color: 'text-success-500' },
  { label: 'Deals Lost', value: '4', icon: XCircle, color: 'text-danger-500' },
  { label: 'Monthly Sales', value: '₹2.4L', icon: BarChart3, color: 'text-fox-500' },
  { label: 'Monthly Target', value: '₹3L', icon: Target, color: 'text-warning-500' },
  { label: 'Conversion Rate', value: '31%', icon: TrendingUp, color: 'text-success-500' },
];

const quickActions = [
  { label: 'Add New Lead', icon: UserPlus, path: '/app/team/sales/leads', color: 'bg-fox-500 hover:bg-fox-600 text-white' },
  { label: 'Generate / View Pitch', icon: Mic, path: '/app/team/sales/pitch-studio', color: 'bg-info-500 hover:bg-info-600 text-white' },
  { label: 'Start Sales Call', icon: Phone, path: '/app/team/sales/sales-call', color: 'bg-success-500 hover:bg-success-600 text-white' },
  { label: 'Add Follow-Up', icon: Calendar, path: '/app/team/sales/follow-ups', color: 'bg-warning-500 hover:bg-warning-600 text-white' },
  { label: 'Create Proposal', icon: FileText, path: '/app/team/sales/proposals', color: 'bg-fox-600 hover:bg-fox-700 text-white' },
  { label: 'View Pitch Library', icon: BookOpen, path: '/app/team/sales/knowledge-center', color: 'bg-warm-700 hover:bg-warm-800 text-white' },
];

export default function SalesDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Sales Overview</h2>
        <p className="text-warm-500 text-sm mt-1">Track your leads, deals, and performance</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-warm-200 p-5 hover:shadow-sm transition">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl bg-warm-50 ${kpi.color}`}>
                <kpi.icon size={20} />
              </div>
              <span className="text-xs text-warm-500 font-medium">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold font-mono text-warm-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-warm-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action) => (
            <NavLink key={action.label} to={action.path} className="flex flex-col items-center gap-3 p-5 rounded-2xl transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className={`p-3 rounded-2xl ${action.color}`}>
                <action.icon size={24} />
              </div>
              <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-warm-900">Recent Leads</h3>
            <NavLink to="/app/team/sales/leads" className="text-xs text-fox-500 hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></NavLink>
          </div>
          <div className="space-y-3">
            {[
              { name: 'FitZone Gym', category: 'Gym', status: 'New Lead', date: 'Today' },
              { name: 'Spice Garden Restaurant', category: 'Restaurant', status: 'Interested', date: 'Yesterday' },
              { name: 'Patna Dental Care', category: 'Dental Clinic', status: 'Meeting Scheduled', date: '2 days ago' },
              { name: 'City Plaza Hotel', category: 'Hotel', status: 'Proposal Sent', date: '3 days ago' },
            ].map((lead) => (
              <div key={lead.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-warm-50 transition">
                <div>
                  <p className="text-sm font-medium text-warm-900">{lead.name}</p>
                  <p className="text-xs text-warm-500">{lead.category}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-fox-600 bg-fox-50 px-2 py-1 rounded-lg">{lead.status}</span>
                  <p className="text-xs text-warm-400 mt-1">{lead.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-warm-900">Today's Follow-ups</h3>
            <NavLink to="/app/team/sales/follow-ups" className="text-xs text-fox-500 hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></NavLink>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Rajesh Kumar', business: 'Kumar Electronics', action: 'Call to discuss proposal', type: 'Call' },
              { name: 'Priya Sharma', business: 'Sharma Cafe', action: 'Send website mockup', type: 'WhatsApp' },
              { name: 'Amit Singh', business: 'Singh Real Estate', action: 'Schedule site visit', type: 'Meeting' },
            ].map((followup, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-warm-50 transition">
                <div>
                  <p className="text-sm font-medium text-warm-900">{followup.name}</p>
                  <p className="text-xs text-warm-500">{followup.business}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-warm-600">{followup.action}</p>
                  <span className="text-xs text-warm-400">{followup.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
