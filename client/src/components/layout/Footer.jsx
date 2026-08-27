import { Link } from 'react-router-dom';
import { ArrowUpRight, Mail, Phone, MapPin } from 'lucide-react';
import { BrandLogo } from '@components/ui/BrandLogo';

const footerLinks = {
  Services: [
    { label: 'Service Builder', href: '/builder' },
    { label: 'Packages', href: '/packages' },
    { label: 'Industry Solutions', href: '/industries' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'All Services', href: '/catalog' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'Project Wall', href: '/project-wall' },
    { label: 'Careers', href: '/careers' },
    { label: 'Blog', href: '/resources' },
    { label: 'Contact', href: '/contact' },
  ],
  Support: [
    { label: 'Help Center', href: '/contact' },
    { label: 'Privacy Policy', href: '/legal/privacy' },
    { label: 'Terms of Service', href: '/legal/terms' },
    { label: 'Refund Policy', href: '/legal/refunds' },
    { label: 'SLA', href: '/legal/sla' },
  ],
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-warm-900 text-warm-300 mt-auto">
      <div className="container-fx">
        {/* CTA Band */}
        <div className="py-12 md:py-16 border-b border-warm-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h3 className="text-display-sm text-white mb-2">Ready to build something great?</h3>
            <p className="text-warm-400 max-w-md">
              Browse 240+ services, configure your perfect solution, and get started today.
            </p>
          </div>
          <Link
            to="/builder"
            className="btn-fox text-base px-8 py-3.5 shrink-0"
          >
            Start Building <ArrowUpRight size={18} />
          </Link>
        </div>

        {/* Links grid */}
        <div className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <BrandLogo size={16} withBackground />
              <div className="flex flex-col">
                <span className="text-lg font-semibold leading-none">
                  <span className="text-white">stack</span>
                  <span className="text-fox-500">fox</span>
                </span>
                <span className="text-[10px] font-bold text-warm-500 leading-none mt-1 tracking-tight">
                  by ARTWALL LABS
                </span>
              </div>
            </div>
            <p className="text-sm text-warm-400 mb-5 leading-relaxed">
              Smart Code, Swift Delivery. A premium product of Artwall Labs.
            </p>
            <div className="space-y-2.5 text-sm">
              <a href="mailto:stackfox.tech@gmail.com" className="flex items-center gap-2 hover:text-fox-400 transition-colors">
                <Mail size={14} /> stackfox.tech@gmail.com
              </a>
              <a href="tel:+918209395894" className="flex items-center gap-2 hover:text-fox-400 transition-colors">
                <Phone size={14} /> +91 82093 95894
              </a>
              <p className="flex items-center gap-2">
                <MapPin size={14} /> Jaipur, Rajasthan
              </p>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link to={link.href} className="text-sm text-warm-400 hover:text-fox-400 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-warm-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-warm-500">
          <p>&copy; {year} Artwall Labs. All rights reserved.</p>
          <div className="flex items-center gap-1 text-xs">
            <span className="font-mono text-fox-500">BUILD</span>
            <span className="text-warm-600">&middot;</span>
            <span className="font-mono text-fox-500">SHIP</span>
            <span className="text-warm-600">&middot;</span>
            <span className="font-mono text-fox-500">SCALE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
