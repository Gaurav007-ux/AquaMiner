/* ============================================================
   AquaYantra — Sidebar navigation
   ============================================================ */

import { clsx } from 'clsx';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Radio,
  Map,
  Database,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  Anchor,
} from 'lucide-react';
import { useUIStore } from '../stores';

const NAV_ITEMS = [
  { path: '/ml', icon: Brain, label: 'ML Survey & Minerals' },
  { path: '/', icon: LayoutDashboard, label: 'Command Overview' },
  { path: '/map', icon: Map, label: 'Seabed Tactical Map' },
  { path: '/live', icon: Radio, label: 'Live Telemetry' },
  { path: '/sensors', icon: Database, label: 'Sensor Explorer' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-full flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] relative z-20 overflow-hidden"
    >
      {/* Logo */}
      <div className="h-[52px] flex items-center gap-2.5 px-4 border-b border-[var(--border-subtle)] shrink-0">
        <Anchor size={20} className="text-cyan-400 shrink-0" />
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-semibold text-[var(--text-primary)] tracking-wide whitespace-nowrap"
          >
            AQUAYANTRA
          </motion.span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md text-sm transition-colors group relative',
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-cyan-400 rounded-r-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon size={18} className="shrink-0" />
                {!collapsed && (
                  <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="h-10 flex items-center justify-center border-t border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  );
}
