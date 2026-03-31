"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { WorkspaceProvider } from "@/components/workspace-provider";
import logo from "@/logo.png";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return <main className="workspace-shell"><div className="status-chip">Loading Brainclip...</div></main>;
  }

  if (status !== "authenticated") {
    return (
      <main className="workspace-shell">
        <section className="signin-stage">
          <div className="stage-copy">
            <span className="eyebrow">Brainclip Studio</span>
            <h1>The fastest way to build vertical reels.</h1>
            <p>
              Sign in to manage your workspace, voices, and rendered history.
            </p>
            <div className="landing-actions">
              <button className="primary-button" onClick={() => signIn("google")}>Sign in with Google</button>
              <Link className="secondary-button inline-link" href="/">View landing page</Link>
            </div>
          </div>
          <div className="signin-panel">
            <div className="signal-card">
              <span className="signal-label">Included</span>
              <div className="catalog-row"><strong>Auth & S3</strong><span>Instant storage provisioning.</span></div>
              <div className="catalog-row"><strong>Voice Routing</strong><span>Fish.audio and custom endpoints.</span></div>
              <div className="catalog-row"><strong>Render Engine</strong><span>Cloud Lambda rendering.</span></div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <WorkspaceProvider>
      <div className="app-shell">
        <aside className="app-sidebar">
          <div className="app-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src={logo} alt="Brainclip Logo" width={32} height={32} className="sidebar-logo" />
            <span>Brainclip</span>
          </div>
          <nav className="app-nav">
            <Link href="/editor" className={`app-nav-item ${pathname === "/editor" ? "active" : ""}`}>
              Editor
            </Link>
            <Link href="/voices" className={`app-nav-item ${pathname === "/voices" ? "active" : ""}`}>
              Voice Library
            </Link>
            <Link href="/jobs" className={`app-nav-item ${pathname === "/jobs" ? "active" : ""}`}>
              Jobs & Activity
            </Link>
            <Link href="/settings" className={`app-nav-item ${pathname === "/settings" ? "active" : ""}`}>
              Studio Settings
            </Link>
          </nav>
          <div className="app-user-section">
            <span className="app-user-email">{session.user?.email}</span>
            <button className="secondary-button" style={{ width: "100%", padding: "8px" }} onClick={() => signOut()}>Sign out</button>
          </div>
        </aside>

        <main className="app-main">
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  );
}
