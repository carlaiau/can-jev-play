import { AppShell } from '../src/components/app-shell';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import './globals.css';
export const metadata = { title: 'Can Jev Play', description: "Test Jev's decisions through games of increasing complexity. Start with dice: can it identify an edge and resist the influence of recent results?" };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}
