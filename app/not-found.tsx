'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Home,
  Search,
  AlertTriangle,
  ArrowLeft,
  Shield,
  Radar,
  ScanLine,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

// ============================================================================
// Animated Background Component
// ============================================================================

function AnimatedBackground(): JSX.Element {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const newParticles: Particle[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#060b17] to-[#0a1628]" />

      {/* Animated grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      {/* Scanning line */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
        initial={{ top: '-2px' }}
        animate={{ top: '100%' }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Floating particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-emerald-500/30"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Ambient glows */}
      <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.03] blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-cyan-500/[0.03] blur-[100px]" />
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/[0.02] blur-[120px]" />
    </div>
  );
}

// ============================================================================
// Glitch Text Component
// ============================================================================

function GlitchText(): JSX.Element {
  const [glitchActive, setGlitchActive] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {/* Main text */}
      <motion.h1
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative text-[120px] font-black leading-none tracking-tighter text-white sm:text-[180px] md:text-[220px]"
      >
        <span
          className={`relative inline-block ${glitchActive ? 'animate-pulse' : ''}`}
        >
          4
          {glitchActive && (
            <>
              <span className="absolute left-[2px] top-0 text-cyan-500 opacity-70 mix-blend-screen">
                4
              </span>
              <span className="absolute -left-[2px] top-0 text-red-500 opacity-70 mix-blend-screen">
                4
              </span>
            </>
          )}
        </span>
        <span className="relative mx-[-10px] inline-block sm:mx-[-15px]">
          <motion.span
            animate={{
              color: ['#ef4444', '#10b981', '#ef4444'],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="relative"
          >
            0
          </motion.span>
          {/* Radar pulse inside 0 */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: [0, 0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="h-12 w-12 rounded-full border-2 border-red-500/50 sm:h-16 sm:w-16" />
          </motion.div>
        </span>
        <span
          className={`relative inline-block ${glitchActive ? 'animate-pulse' : ''}`}
        >
          4
          {glitchActive && (
            <>
              <span className="absolute left-[2px] top-0 text-cyan-500 opacity-70 mix-blend-screen">
                4
              </span>
              <span className="absolute -left-[2px] top-0 text-red-500 opacity-70 mix-blend-screen">
                4
              </span>
            </>
          )}
        </span>
      </motion.h1>

      {/* Scan line effect over text */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent"
        style={{ height: '10px' }}
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ============================================================================
// Radar Component
// ============================================================================

function RadarAnimation(): JSX.Element {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {/* Radar circles */}
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/20"
          style={{
            width: `${i * 120}px`,
            height: `${i * 120}px`,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.2, duration: 0.5 }}
        />
      ))}

      {/* Radar sweep */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[240px] w-[2px] origin-bottom -translate-x-1/2 bg-gradient-to-t from-emerald-500/50 to-transparent"
        style={{ transformOrigin: '50% 100%' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      {/* Center dot */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500"
        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Random blips */}
      {[
        { x: 60, y: -40, delay: 0 },
        { x: -80, y: 20, delay: 1 },
        { x: 30, y: 70, delay: 2 },
        { x: -50, y: -60, delay: 0.5 },
      ].map((blip, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-red-500"
          style={{ x: blip.x, y: blip.y }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: blip.delay,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Status Cards Component
// ============================================================================

function StatusCards(): JSX.Element {
  const cards = [
    {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'Page Not Found',
      status: 'ERROR',
    },
    {
      icon: <ScanLine className="h-4 w-4" />,
      label: 'Scanning Routes',
      status: 'ACTIVE',
    },
    {
      icon: <Shield className="h-4 w-4" />,
      label: 'Security Status',
      status: 'SECURE',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="mt-8 flex flex-wrap justify-center gap-3"
    >
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 + index * 0.1 }}
          className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2 backdrop-blur-sm"
        >
          <span
            className={
              card.status === 'ERROR' ? 'text-red-400' : 'text-emerald-400'
            }
          >
            {card.icon}
          </span>
          <span className="text-xs text-slate-400">{card.label}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              card.status === 'ERROR'
                ? 'bg-red-500/20 text-red-400'
                : card.status === 'ACTIVE'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {card.status}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ============================================================================
// Terminal Component
// ============================================================================

function Terminal(): JSX.Element {
  const [lines, setLines] = useState<string[]>([]);
  const terminalLines = [
    '> Initializing route scan...',
    '> Checking path: /unknown',
    '> ERROR: Route not found in registry',
    '> Attempting recovery...',
    '> Suggestion: Return to home base',
  ];

  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < terminalLines.length) {
        setLines((prev) => [...prev, terminalLines[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2 }}
      className="mx-auto mt-8 max-w-md rounded-xl border border-slate-700/50 bg-slate-900/80 p-4 font-mono text-sm backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-red-500" />
        <div className="h-3 w-3 rounded-full bg-amber-500" />
        <div className="h-3 w-3 rounded-full bg-emerald-500" />
        <span className="ml-2 text-xs text-slate-500">scaninfoga-terminal</span>
      </div>
      <div className="space-y-1">
        {lines.map((line, index) => {
          const lineText = line || '';
          const colorClass = lineText.includes('ERROR')
            ? 'text-red-400'
            : lineText.includes('Suggestion')
              ? 'text-emerald-400'
              : 'text-slate-400';

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={colorClass}
            >
              {lineText}
            </motion.div>
          );
        })}
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="inline-block h-4 w-2 bg-emerald-500"
        />
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main 404 Component
// ============================================================================

export default function NotFound(): JSX.Element {
  const router = useRouter();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060b17]">
      <AnimatedBackground />

      {/* Radar in background */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <RadarAnimation />
      </div>

      {/* Main content */}
      <div className="relative z-10 px-4 text-center">
        {/* Glitch 404 */}
        <GlitchText />

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4"
        >
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Target{' '}
            <span className="bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">
              Not Located
            </span>
          </h2>
          <p className="mt-3 text-slate-400">
            The page you&apos;re looking for has been moved, deleted, or never
            existed.
          </p>
        </motion.div>

        {/* Status Cards */}
        <StatusCards />

        {/* Terminal */}
        <Terminal />

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <button
            onClick={() => router.push('/')}
            className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 font-semibold text-white transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25"
          >
            <Home className="h-5 w-5 transition-transform group-hover:scale-110" />
            <span>Return Home</span>
          </button>

          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-300 transition-all duration-300 hover:border-emerald-500/50 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Go Back</span>
          </button>

          <button
            onClick={() => router.push('/tools')}
            className="flex items-center gap-2 rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-300 transition-all duration-300 hover:border-cyan-500/50 hover:text-white"
          >
            <Search className="h-5 w-5" />
            <span>Explore Tools</span>
          </button>
        </motion.div>

        {/* Error code */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="mt-12 flex items-center justify-center gap-2 text-xs text-slate-600"
        >
          <span>Error Code:</span>
          <span className="font-mono text-slate-500">HTTP_404_NOT_FOUND</span>
          <span className="mx-2">|</span>
          <span>Timestamp:</span>
          <span className="font-mono text-slate-500">
            {new Date().toISOString().slice(0, 19).replace('T', ' ')}
          </span>
        </motion.div>
      </div>

      {/* Corner decorations */}
      <div className="pointer-events-none absolute left-4 top-4 h-20 w-20 border-l-2 border-t-2 border-emerald-500/20" />
      <div className="pointer-events-none absolute right-4 top-4 h-20 w-20 border-r-2 border-t-2 border-emerald-500/20" />
      <div className="pointer-events-none absolute bottom-4 left-4 h-20 w-20 border-b-2 border-l-2 border-emerald-500/20" />
      <div className="pointer-events-none absolute bottom-4 right-4 h-20 w-20 border-b-2 border-r-2 border-emerald-500/20" />

      {/* Scanlines overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]" />
    </div>
  );
}
