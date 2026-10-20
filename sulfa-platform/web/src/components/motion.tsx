'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from './ui';

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

/** true once the element has entered the viewport (stays true) */
export function useInView<T extends Element>(margin = '0px 0px -12% 0px'): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || seen) return;
    if (!('IntersectionObserver' in window)) { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen];
}

/** fades / slides its children in when scrolled into view; `delay` in ms staggers siblings */
export function Reveal({ children, delay = 0, from = 'up', className, as: As = 'div' }: { children: ReactNode; delay?: number; from?: 'up' | 'left' | 'right' | 'zoom'; className?: string; as?: 'div' | 'li' | 'section' }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <As ref={ref as never} className={cx('reveal', `reveal-${from}`, seen && 'is-in', className)} style={{ transitionDelay: `${delay}ms` } as CSSProperties}>
      {children}
    </As>
  );
}

/** animates a number from 0 to `to` once visible (ease-out cubic); returns the formatted text */
export function CountUp({ to, duration = 1400, format }: { to: number; duration?: number; format: (n: number) => string }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const reduced = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (reduced) { setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - t0) / duration); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, duration, reduced]);
  return <span ref={ref}>{format(v)}</span>;
}

/** smoothly tweens between successive values (used by the simulator) */
export function useTween(target: number, duration = 450): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { setV(target); from.current = target; return; }
    const start = from.current; let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - t0) / duration); const x = start + (target - start) * (1 - Math.pow(1 - p, 3)); setV(x); from.current = x; if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return v;
}

/** 3D tilt following the pointer (desktop only, disabled for reduced motion) */
export function Tilt({ children, className, max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || reduced || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * max}deg) rotateX(${-y * max}deg) translateZ(0)`;
    el.style.setProperty('--gx', `${(x + 0.5) * 100}%`); el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
  };
  const leave = () => { const el = ref.current; if (el) el.style.transform = ''; };
  return <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={cx('tilt', className)}>{children}</div>;
}
