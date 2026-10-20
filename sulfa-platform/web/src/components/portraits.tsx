'use client';
/* Photorealistic portraits (AI-generated, illustrative). They depict ROLES (client, client,
   administrator) — not real customers or staff — and are labelled as illustrative on the page. */
import { cx } from './ui';

export type Who = 'aisha' | 'salim' | 'maryam';

/** Small round avatar (face crop, 192 px) — or the full 960 px portrait with `large`. */
export function Portrait({ who, className, title, ring, large }: { who: Who; className?: string; title?: string; smile?: boolean; ring?: boolean; large?: boolean }) {
  return (
    <img
      src={large ? `/people/${who}.webp` : `/people/${who}-face.webp`}
      alt={title ?? ''}
      aria-label={title || undefined}
      role="img"
      width={large ? 960 : 192}
      height={large ? 960 : 192}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cx('portrait block h-full w-full object-cover', ring && 'ring-4 ring-white dark:ring-emerald-900 rounded-full', className)}
    />
  );
}
