'use client';
/* re-mounted on every navigation: gives each page a short entrance animation */
export default function Template({ children }: { children: React.ReactNode }) { return <div className="page-enter">{children}</div>; }
