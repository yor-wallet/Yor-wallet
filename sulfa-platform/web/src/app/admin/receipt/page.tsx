'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Receipt } from '@/components/receipt';
function R() { const q = useSearchParams(); return <Receipt tx={q.get('tx')} app={q.get('app')} admin />; }
export default function Page() { return <Suspense><R /></Suspense>; }
