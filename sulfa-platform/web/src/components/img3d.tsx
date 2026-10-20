'use client';
/* HD 3D illustrations rendered with three.js (tools/render3d): WebP with PNG fallback, transparent, 1536 px. */
import { useRef } from 'react';
import { cx } from './ui';
import { useReducedMotion } from './motion';

export type Asset3D = 'card' | 'coins' | 'shield' | 'idcard' | 'calendar' | 'bell';

export function Img3D({ name, alt = '', className, float = true, parallax = false, eager }: { name: Asset3D; alt?: string; className?: string; float?: boolean; parallax?: boolean; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || reduced || !parallax || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg) translate3d(${x * 10}px, ${y * 8}px, 0)`;
  };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={() => { if (ref.current) ref.current.style.transform = ''; }} className={cx('img3d', className)}>
      <picture className={cx('block', float && !reduced && 'float-3d')}>
        <source srcSet={`/3d/${name}.webp`} type="image/webp" />
        <img src={`/3d/${name}.png`} alt={alt} width={1536} height={1536} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} className="h-auto w-full select-none" />
      </picture>
    </div>
  );
}
