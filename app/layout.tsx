import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import './globals.css';
export const metadata = { title: 'Dice Lab — JEV experiments', description: 'Compare what JEV decides from a payout table and a calculated expected value, before the dice are rolled.' };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
