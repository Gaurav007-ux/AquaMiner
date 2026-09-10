/* ============================================================
   AquaYantra — Login & Operator Authentication Page
   Command center authentication with dark oceanic theme
   and quick demo launch button
   ============================================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Anchor, Shield, ArrowRight, Beaker, Lock, Mail } from 'lucide-react';
import { useDeviceStore } from '../stores';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('operator@aquayantra.marine');
  const [password, setPassword] = useState('••••••••••••');
  const [isLoading, setIsLoading] = useState(false);

  const setConnectionStatus = useDeviceStore((s) => s.setConnectionStatus);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setConnectionStatus('connected');
      navigate('/');
    }, 600);
  };

  const handleLaunchDemo = () => {
    navigate('/');
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050912] relative overflow-hidden select-none">
      {/* Background Decorative Grid and Bathymetry Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(8,145,178,0.12)_0%,_transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0d1527_1px,transparent_1px),linear-gradient(to_bottom,#0d1527_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Main Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md p-8 rounded-xl bg-[#0a1120]/90 border border-[var(--border-medium)] shadow-2xl backdrop-blur-xl relative z-10 space-y-6"
      >
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-1 shadow-lg shadow-cyan-500/10">
            <Anchor size={28} />
          </div>
          <h1 className="text-xl font-bold tracking-widest text-white font-mono">
            AQUAYANTRA
          </h1>
          <p className="text-xs text-[var(--text-muted)] tracking-wider uppercase font-mono">
            Marine Research & Seabed Reconnaissance Platform
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
              Operator Identification
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg py-2.5 pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-cyan-400 font-mono transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
              Security Keycode
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg py-2.5 pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-cyan-400 font-mono transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider transition-all duration-200 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 mt-2"
          >
            <span>{isLoading ? 'AUTHENTICATING...' : 'AUTHORIZE COMMAND SESSION'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
          <span className="flex-shrink mx-3 text-[10px] font-mono text-[var(--text-muted)] uppercase">
            OR DEMO PRESENTATION
          </span>
          <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
        </div>

        {/* Instant Launch Demo Button */}
        <button
          type="button"
          onClick={handleLaunchDemo}
          className="w-full py-2.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-medium)] text-cyan-300 font-semibold text-xs font-mono tracking-wider transition-colors flex items-center justify-center gap-2"
        >
          <Beaker size={14} className="text-amber-400" />
          <span>LAUNCH DEMO OPERATOR SESSION</span>
        </button>

        {/* Security Footer */}
        <div className="pt-2 text-center text-[10px] font-mono text-[var(--text-muted)] flex items-center justify-center gap-1.5">
          <Shield size={12} className="text-emerald-400" />
          <span>AES-256 ENCRYPTED TELEMETRY LINK</span>
        </div>
      </motion.div>
    </div>
  );
}
