 'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BeakerIcon, ChartBarIcon, DocumentTextIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
export function AppShell({children}:{children:ReactNode}){
 const pathname=usePathname();
 return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Can Jev Play home"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><rect width="48" height="48" rx="12" fill="currentColor"/><g transform="rotate(12 31 21)"><rect x="22" y="8" width="17" height="25" rx="3" fill="white"/><path d="m30.5 12-4 5 4 5 4-5Z" fill="currentColor"/></g><rect x="7" y="22" width="22" height="20" rx="5" fill="currentColor"/><rect x="8" y="23" width="19" height="17" rx="4" fill="white"/><g fill="currentColor"><circle cx="12.5" cy="27.5" r="1.65"/><circle cx="22.5" cy="27.5" r="1.65"/><circle cx="17.5" cy="31.5" r="1.65"/><circle cx="12.5" cy="35.5" r="1.65"/><circle cx="22.5" cy="35.5" r="1.65"/></g></svg></span><span>Can Jev Play<span className="brand-sub">Games of judgment</span></span></Link>
      <nav aria-label="Main navigation">
        <Link aria-current={pathname === '/' ? 'page' : undefined} className={pathname === '/' ? 'nav-active' : ''} href="/"><BeakerIcon /><span>Dice lab</span></Link>
        <Link aria-current={pathname === '/experiments' ? 'page' : undefined} className={pathname === '/experiments' ? 'nav-active' : ''} href="/experiments"><ChartBarIcon /><span>Experiments</span></Link>
        <Link aria-current={pathname === '/findings' ? 'page' : undefined} className={pathname === '/findings' ? 'nav-active' : ''} href="/findings"><DocumentTextIcon /><span>Findings</span></Link>
        <Link aria-current={pathname === '/guide' ? 'page' : undefined} className={pathname === '/guide' ? 'nav-active' : ''} href="/guide"><InformationCircleIcon /><span>Guide</span></Link>
      </nav>
      <a className="sidebar-github" href="https://github.com/carlaiau/can-jev-play" target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.769-.244.769-.543 0-.267-.01-.975-.015-1.913-3.13.68-3.79-1.508-3.79-1.508-.511-1.299-1.248-1.645-1.248-1.645-1.022-.699.078-.685.078-.685 1.13.08 1.725 1.16 1.725 1.16 1.004 1.72 2.633 1.223 3.274.936.102-.728.393-1.224.714-1.506-2.498-.284-5.124-1.249-5.124-5.561 0-1.229.439-2.234 1.16-3.021-.117-.285-.503-1.429.11-2.978 0 0 .945-.303 3.094 1.154A10.78 10.78 0 0 1 12 6.195c.956.005 1.918.129 2.817.379 2.148-1.457 3.091-1.154 3.091-1.154.615 1.549.229 2.693.113 2.978.722.787 1.159 1.792 1.159 3.021 0 4.324-2.63 5.274-5.136 5.553.404.35.766 1.043.766 2.102 0 1.518-.014 2.743-.014 3.116 0 .302.203.653.774.542A11.251 11.251 0 0 0 12 .75Z"/></svg><span>View on GitHub</span></a>
    </aside>
<div className="workspace"><main id="main-content">{children}</main></div></div>;
}
