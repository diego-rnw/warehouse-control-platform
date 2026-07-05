import type { ReactNode } from 'react';
import Nav from './Nav';
import Tour from './Tour';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--canvas)' }}>{children}</main>
      <Tour />
    </>
  );
}
