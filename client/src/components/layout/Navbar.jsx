import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, Menu, X, ChevronDown, User, LogOut, LayoutDashboard,
  Hammer, Package, Building2, Briefcase, BookOpen, Phone, Tag, Layers,
  FileText, Sparkles, ArrowRight, Search, Home
} from 'lucide-react';
import { cn } from '@lib/utils';
import { useScrollPosition, useClickOutside } from '@lib/hooks';
import useAuthStore from '@store/authStore';
import useCartStore from '@store/cartStore';
import useUiStore from '@store/uiStore';
import { Button } from '@components/ui/Primitives';
import { BrandLogo } from '@components/ui/BrandLogo';
import SearchOverlay from '@components/ui/SearchOverlay';
import { toast } from 'react-hot-toast';

// ── Primary nav (always visible on desktop) ─────────────────────────────────
const PRIMARY_LINKS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Builder', href: '/builder', icon: Hammer },
  { label: 'Packages', href: '/packages', icon: Package },
  { label: 'Industries', href: '/industries', icon: Building2 },
  { label: 'Portfolio', href: '/portfolio', icon: Layers },
  { label: 'Pricing', href: '/pricing', icon: Tag },
];

// ── "More" mega-menu groups ─────────────────────────────────────────────────
const MORE_GROUPS = [
  {
    title: 'Explore',
    links: [
       { label: 'All Services', href: '/catalog', icon: Layers, desc: '240+ pieces, 13 domains' },
      { label: 'About Us', href: '/about', icon: Sparkles, desc: 'Story, values & team' },
      { label: 'Resources', href: '/resources', icon: BookOpen, desc: 'Blog, guides & case studies' },
    ],
  },
  {
    title: 'Work with us',
    links: [
      { label: 'Careers', href: '/careers', icon: Briefcase, desc: 'Join the team' },
      { label: 'Project Wall', href: '/project-wall', icon: FileText, desc: 'Live & delivered projects' },
      { label: 'Contact', href: '/contact', icon: Phone, desc: 'Book a free call' },
    ],
  },
];

// ── Logo ────────────────────────────────────────────────────────────────────
const FoxLogo = () => (
  <Link to="/" className="flex items-center gap-2 group">
    <BrandLogo 
      size={28} 
      withBackground 
      containerClassName="group-hover:scale-105 transition-transform" 
    />
    <div className="flex flex-col">
      <span className="text-xl font-semibold leading-none">
        <span className="text-warm-900">stack</span>
        <span className="text-fox-500">fox</span>
      </span>
      <span className="text-[10px] font-bold text-warm-400 leading-none mt-0.5 tracking-tighter">
        by ARTWALL LABS
      </span>
    </div>
  </Link>
);

// ── User menu (auth dropdown) ───────────────────────────────────────────────
const UserMenu = () => {
  const [open, setOpen] = useState(false);
  const { user, logout, getDashboardPath } = useAuthStore();
  const navigate = useNavigate();
  const ref = useClickOutside(() => setOpen(false));

  if (!user) return null;

  const dashPath = getDashboardPath();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-warm-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-fox-100 text-fox-700 flex items-center justify-center text-sm font-medium">
          {user.name?.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-warm-800 hidden sm:block max-w-[120px] truncate">
          {user.name?.split(' ')[0]}
        </span>
        <ChevronDown
          size={14}
          className={cn('text-warm-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-elevated border border-warm-100 py-1 z-50 animate-scale-in">
          <div className="px-4 py-2.5 border-b border-warm-100">
            <p className="text-sm font-medium text-warm-900 truncate">{user.name}</p>
            <p className="text-xs text-warm-500 truncate">{user.email}</p>
            <span className="badge-fx badge-fox mt-1 text-[10px]">{user.role}</span>
          </div>

          <button
            onClick={() => {
              navigate(dashPath);
              setOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-warm-700 hover:bg-warm-50 transition-colors"
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button
            onClick={() => {
              navigate(`${dashPath}/profile`);
              setOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-warm-700 hover:bg-warm-50 transition-colors"
          >
            <User size={16} /> Profile
          </button>

          <div className="border-t border-warm-100 mt-1 pt-1">
            <button
              onClick={() => {
                logout();
                setOpen(false);
                navigate('/');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-500 hover:bg-danger-50 transition-colors"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Inactive Click Handler ───────────────────────────────────────────────
const handleInactiveClick = (e) => {
  e.preventDefault();
  toast('These are inactive for now. We will activate them soon.', {
    icon: '⏳',
    style: {
      borderRadius: '12px',
      background: '#333',
      color: '#fff',
    },
  });
};

// ── More mega-menu ──────────────────────────────────────────────────────────
const MoreMenu = () => {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const location = useLocation();

  const isActive = MORE_GROUPS.some((g) =>
    g.links.some((l) => location.pathname.startsWith(l.href))
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
          isActive || open
            ? 'text-fox-500 bg-fox-50'
            : 'text-warm-600 hover:text-warm-900 hover:bg-warm-50'
        )}
      >
        More
        <ChevronDown
          size={14}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[520px] bg-white rounded-2xl shadow-elevated border border-warm-100 p-5 z-50 animate-scale-in">
          <div className="grid grid-cols-2 gap-5">
            {MORE_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider mb-3 px-2">
                  {group.title}
                </div>
                <div className="space-y-1">
                  {group.links.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        to={link.inactive ? '#' : link.href}
                        onClick={(e) => {
                          if (link.inactive) {
                            handleInactiveClick(e);
                          } else {
                            setOpen(false);
                          }
                        }}
                        className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-warm-50 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-fox-50 text-fox-500 flex items-center justify-center flex-shrink-0 group-hover:bg-fox-100 transition-colors">
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-warm-900">
                            {link.label}
                          </div>
                          <div className="text-[11px] text-warm-500 leading-tight mt-0.5">
                            {link.desc}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-warm-100">
            <Link
              to="/contact"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-2 py-1 text-xs text-warm-600 hover:text-fox-500 transition-colors"
            >
              <span>Have a question? Talk to our team</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Active state helper (matches child paths too) ───────────────────────────
const isLinkActive = (path, current) => {
  if (path === '/') return current === '/';
  return current === path || current.startsWith(path + '/');
};

// ────────────────────────────────────────────────────────────────────────────
// Navbar
// ────────────────────────────────────────────────────────────────────────────
export default function Navbar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isScrolled = useScrollPosition(20);
  const { isAuthenticated } = useAuthStore();
  const { itemCount, toggleCart } = useCartStore();
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useUiStore();
  const location = useLocation();

  // Hide navbar on dashboard pages (they have their own sidebar)
  const isDashboard = location.pathname.startsWith('/app/');
  if (isDashboard) return null;

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-white/90 backdrop-blur-lg shadow-nav border-b border-warm-100'
          : 'bg-warm-white/60 backdrop-blur-sm'
      )}
    >
      <div className="container-fx">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <FoxLogo />

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.inactive ? '#' : link.href}
                onClick={(e) => {
                  if (link.inactive) handleInactiveClick(e);
                }}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  isLinkActive(link.href, location.pathname)
                    ? 'text-fox-500 bg-fox-50'
                    : 'text-warm-600 hover:text-warm-900 hover:bg-warm-50'
                )}
              >
                {link.label}
              </Link>
            ))}
            <MoreMenu />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Search Button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2.5 rounded-xl hover:bg-warm-100 transition-colors text-warm-700"
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {/* Builder (Mobile Shortcut) */}
            <Link
              to="/builder"
              className="lg:hidden p-2.5 rounded-xl hover:bg-warm-100 transition-colors text-warm-700"
              aria-label="Builder"
            >
              <Hammer size={20} />
            </Link>

            {/* Cart */}
            <button
              onClick={toggleCart}
              className="relative p-2.5 rounded-xl hover:bg-warm-100 transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart size={20} className="text-warm-700" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-fox-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>

            {/* Auth */}
            {isAuthenticated ? (
              <UserMenu />
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="primary" size="sm">
                    Get started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden p-2.5 rounded-xl hover:bg-warm-100 transition-colors"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Mobile drawer ─── */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-warm-100 shadow-elevated animate-slide-up max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="container-fx py-4 space-y-4">
            {/* Primary section */}
            <div>
              <div className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider px-3 mb-1">
                Browse
              </div>
              <div className="space-y-0.5">
                {PRIMARY_LINKS.map((link) => {
                  const Icon = link.icon;
                  const active = isLinkActive(link.href, location.pathname);
                  return (
                    <Link
                      key={link.href}
                      to={link.inactive ? '#' : link.href}
                      onClick={(e) => {
                        if (link.inactive) {
                          handleInactiveClick(e);
                        } else {
                          closeMobileMenu();
                        }
                      }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors',
                        active
                          ? 'text-fox-500 bg-fox-50'
                          : 'text-warm-700 hover:bg-warm-50'
                      )}
                    >
                      <Icon size={16} className={active ? 'text-fox-500' : 'text-warm-400'} />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* More groups, expanded inline */}
            {MORE_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider px-3 mb-1">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.links.map((link) => {
                    const Icon = link.icon;
                    const active = isLinkActive(link.href, location.pathname);
                    return (
                      <Link
                        key={link.href}
                        to={link.inactive ? '#' : link.href}
                        onClick={(e) => {
                          if (link.inactive) {
                            handleInactiveClick(e);
                          } else {
                            closeMobileMenu();
                          }
                        }}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors',
                          active
                            ? 'text-fox-500 bg-fox-50'
                            : 'text-warm-700 hover:bg-warm-50'
                        )}
                      >
                        <Icon size={16} className={active ? 'text-fox-500' : 'text-warm-400'} />
                        {link.label}
                        {link.href === '/project-wall' && (
                          <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-success-500 bg-success-50 px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                            Live
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Auth buttons */}
            {!isAuthenticated && (
              <div className="flex gap-2 pt-3 border-t border-warm-100">
                <Link to="/login" onClick={closeMobileMenu} className="flex-1">
                  <Button variant="outline" size="md" className="w-full">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup" onClick={closeMobileMenu} className="flex-1">
                  <Button variant="primary" size="md" className="w-full">
                    Get started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Search Overlay */}
      <SearchOverlay 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
    </nav>
  );
}
