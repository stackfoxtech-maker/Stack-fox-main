import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Mail, Phone, MapPin } from 'lucide-react';
import { BrandLogo, Tagline, Wordmark } from '@components/ui/BrandLogo';

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
    { label: 'Help Center', href: '/help' },
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
        <div className="py-16 md:py-24 border-b border-white/10 flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-display-lg md:text-display-xl text-white mb-4">
              Ready to price your project?
            </h2>
            <p className="text-warm-300 max-w-md text-body-lg">
              Open the builder, add the pieces you need, and see the number in a couple of minutes.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:shrink-0">
            <Link to="/builder" className="btn-fox w-full px-8 text-base sm:w-auto">
              Start building <ArrowUpRight size={18} />
            </Link>
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center gap-1 px-4 text-body-sm font-medium text-warm-300 transition-colors hover:text-white"
            >
              Talk to us <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Links grid */}
        <div className="py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <BrandLogo size={24} />
              <div className="flex flex-col">
                <Wordmark dark className="text-lg" />
                <Tagline dark className="mt-1 tracking-tight" />
              </div>
            </Link>
            <p className="text-body-sm text-warm-400 mb-5 leading-relaxed">
              Smart Code, Swift Delivery. A premium product of Artwall Labs.
            </p>
            <div className="space-y-0 text-body-sm md:space-y-2">
              <a
                href="mailto:stackfox.tech@gmail.com"
                className="flex min-h-11 items-center gap-2 transition-colors hover:text-white md:min-h-0"
              >
                <Mail size={14} className="text-warm-500" /> stackfox.tech@gmail.com
              </a>
              <a
                href="tel:+918209395894"
                className="flex min-h-11 items-center gap-2 transition-colors hover:text-white md:min-h-0"
              >
                <Phone size={14} className="text-warm-500" /> +91 82093 95894
              </a>
              <p className="flex items-center gap-2">
                <MapPin size={14} className="text-warm-500" /> Jaipur, Rajasthan
              </p>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-caption font-medium uppercase tracking-wide text-warm-400 mb-2 md:mb-4">
                {title}
              </h3>
              <ul className="md:space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="flex min-h-11 items-center text-body-sm text-warm-300 transition-colors hover:text-white md:inline-flex md:min-h-0"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-caption text-warm-400">
          <p>&copy; {year} Artwall Labs. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {footerLinks.Support.filter((l) => l.href.startsWith('/legal')).map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="inline-flex min-h-11 items-center transition-colors hover:text-white sm:min-h-0"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
