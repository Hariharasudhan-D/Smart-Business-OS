import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, LayoutDashboard, Menu, Package, Receipt, ShoppingCart, Truck, Users, X } from 'lucide-react';
const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  {
    label: 'Products',
    icon: Package,
    children: [
      { to: '/products/add', label: 'Add Products' },
      { to: '/products/selling', label: 'Selling Products' },
      { to: '/products/purchase', label: 'Purchase Products' },
    ],
  },
  { to: '/purchases', label: 'Purchases', icon: Truck },
  {
    label: 'Customers',
    icon: Users,
    children: [
      { to: '/customers/add', label: 'Add Customers' },
      { to: '/customers/buyers', label: 'Buyers' },
      { to: '/customers/sellers', label: 'Sellers' },
    ],
  },
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
];
const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
function NavGroup({ label, icon: Icon, items, onNavigate }) {
  const { pathname } = useLocation();
  const hasActive = items.some((i) => pathname.startsWith(i.to));
  const [open, setOpen] = useState(hasActive);
  // Open the group when navigation lands inside it; otherwise the arrow controls it.
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100 ${hasActive ? 'text-indigo-700' : 'text-slate-600'}`}
      >
        <Icon size={18} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="ml-5 mt-1 space-y-1 border-l border-slate-200 pl-3">
          {items.map((c) => (
            <NavLink key={c.to} to={c.to} onClick={onNavigate} className={linkClass}>
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Receipt size={18} />
        </div>
        <span className="text-base font-semibold text-slate-900">Smart Business OS</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ to, label, icon: Icon, end, children }) =>
          children ? (
            <NavGroup key={label} label={label} icon={Icon} items={children} onNavigate={onNavigate} />
          ) : (
            <NavLink key={to} to={to} end={end} onClick={onNavigate} className={linkClass}>
              <Icon size={18} />
              {label}
            </NavLink>
          ),
        )}
      </nav>
      <div className="border-t border-slate-200 p-4 text-xs text-slate-400">Data saved in Supabase</div>
    </div>
  );
}
export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close menu">
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <button onClick={() => setOpen(true)} className="-ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
              <Menu size={22} />
            </button>
            <span className="truncate text-sm font-semibold text-slate-900">Smart Business OS</span>
          </div>
          <div className="hidden text-sm text-slate-500 lg:block">Admin dashboard</div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">AD</div>
              <span className="hidden text-sm font-medium text-slate-700 sm:block">Admin</span>
            </div>
          </div>
        </header>
        <main className="mx-auto min-w-0 max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
