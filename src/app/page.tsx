"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { duoPresets, subtitlePresetCatalog, voicePresetCatalog, assetPackCatalog } from "@/lib/catalog";

/* ─── Data ─── */

const pillars = [
  {
    icon: "🎭",
    title: "Duo Dialogue Engine",
    body: "Two AI voices having a real conversation. Debate, interview, or explainer — formats engineered to keep viewers watching till the very last second.",
    accent: "var(--accent)",
  },
  {
    icon: "🎙️",
    title: "AI Voice Studio",
    body: "Pick from expressive voice packs or clone your own. Every line is timed, tuned, and production-ready — no recording booth needed.",
    accent: "var(--sky)",
  },
  {
    icon: "⚡",
    title: "One-Click Export",
    body: "HD vertical reels rendered in the cloud. Ready to post on Instagram, TikTok, or YouTube Shorts in minutes, not hours.",
    accent: "var(--accent-deep)",
  },
];

const stats = [
  { value: "60s", label: "Reel length", icon: "⏱" },
  { value: "720p", label: "HD quality", icon: "📺" },
  { value: "8+", label: "Voice packs", icon: "🎤" },
  { value: "∞", label: "Ideas to reels", icon: "💡" },
];

const steps = [
  { title: "Describe your idea", body: "A topic, a hot take, a story — type it in one sentence. Brainclip writes the script." },
  { title: "Pick a format", body: "Debate, explainer, host-guest, or something entirely your own." },
  { title: "Choose your style", body: "Select voices, subtitle effects, and a visual direction that matches your brand." },
  { title: "Edit & refine", body: "Review the AI-generated dialogue. Tweak any line, swap voices, adjust timing." },
  { title: "Render & post", body: "Hit render. Your polished vertical reel is ready to download and post everywhere." },
];

const socialProof = [
  { metric: "10x", label: "Faster than editing manually" },
  { metric: "$0", label: "Cost per reel on free tier" },
  { metric: "< 3 min", label: "Average time to first reel" },
];

/* ─── Scroll Animation Hook ─── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    el.querySelectorAll(".reveal-on-scroll").forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─── Component ─── */

export default function HomePage() {
  const scrollRef = useScrollReveal();

  return (
    <div ref={scrollRef}>
      {/* ─── Top Navigation ─── */}
      <nav className="landing-nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-text">Brainclip</span>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#workflow" className="nav-link">How it works</a>
            <a href="#library" className="nav-link">Library</a>
            <Link href="/editor" className="nav-cta">Open Studio →</Link>
          </div>
        </div>
      </nav>

      <main className="landing-main">
        {/* ─── Hero ─── */}
        <section className="hero-section">
          <div className="hero-bg-orbs" aria-hidden="true">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />
          </div>

          <div className="hero-container">
            <div className="hero-badge animate-hero">
              <span className="badge-dot" />
              AI-Powered Reel Creator
            </div>

            <h1 className="hero-title animate-hero delay-1">
              Turn any idea into<br />
              <span className="hero-gradient-text">addictive reels.</span>
            </h1>

            <p className="hero-subtitle animate-hero delay-2">
              Type an idea. Pick a format. Choose AI voices. Get a scroll-stopping
              short-form reel in minutes — no editing skills, no recording gear,
              no complicated timeline.
            </p>

            <div className="hero-actions animate-hero delay-3">
              <Link href="/editor" className="hero-primary-btn">
                <span>Create your first reel</span>
                <span className="btn-arrow">→</span>
              </Link>
              <a href="#workflow" className="hero-secondary-btn">
                See how it works
              </a>
            </div>

            {/* Stats ribbon */}
            <div className="stats-ribbon animate-hero delay-4">
              {stats.map((s) => (
                <div className="stat-chip" key={s.label}>
                  <span className="stat-icon">{s.icon}</span>
                  <div>
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Social Proof Bar ─── */}
        <section className="proof-bar reveal-on-scroll">
          <div className="proof-inner">
            {socialProof.map((item) => (
              <div className="proof-item" key={item.label}>
                <strong>{item.metric}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Features ─── */}
        <section className="features-section" id="features">
          <div className="section-container">
            <div className="section-header reveal-on-scroll">
              <span className="section-tag">Features</span>
              <h2>From blank page to viral reel<br />in three moves.</h2>
              <p className="section-sub">Each pillar is designed to eliminate one barrier between your idea and a finished reel.</p>
            </div>

            <div className="pillars-grid">
              {pillars.map((item, i) => (
                <article className={`pillar-card reveal-on-scroll stagger-${i}`} key={item.title}>
                  <div className="pillar-accent" style={{ background: item.accent }} />
                  <div className="pillar-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <div className="pillar-glow" style={{ background: item.accent }} />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Workflow ─── */}
        <section className="workflow-section" id="workflow">
          <div className="section-container">
            <div className="section-header reveal-on-scroll">
              <span className="section-tag">Workflow</span>
              <h2>Five steps. Zero learning curve.</h2>
            </div>

            <div className="steps-track">
              <div className="steps-line" aria-hidden="true" />
              {steps.map((step, i) => (
                <div className={`step-card reveal-on-scroll stagger-${i}`} key={step.title}>
                  <div className="step-number">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="step-content">
                    <h4>{step.title}</h4>
                    <p>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Library ─── */}
        <section className="library-section" id="library">
          <div className="section-container">
            <div className="section-header reveal-on-scroll">
              <span className="section-tag">Library</span>
              <h2>Start with a format. Make it yours.</h2>
              <p className="section-sub">Everything you need to go from concept to finished reel, pre-built and customizable.</p>
            </div>

            <div className="library-grid">
              {/* Duo Formats */}
              <div className="library-column reveal-on-scroll">
                <h3 className="library-col-title">Duo Formats</h3>
                <div className="format-cards">
                  {duoPresets.map((preset) => (
                    <div className="format-card" key={preset.id}>
                      <div className="format-card-header">
                        <strong>{preset.label}</strong>
                        <span className="format-tone">{preset.tone}</span>
                      </div>
                      <p>{preset.hook}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column: stacked cards */}
              <div className="library-column reveal-on-scroll stagger-1">
                <div className="library-stack-card">
                  <h3 className="library-col-title">Voice Packs</h3>
                  {voicePresetCatalog.slice(0, 3).map((voice) => (
                    <div className="lib-row" key={voice.id}>
                      <div className="lib-row-left">
                        <span className="lib-row-dot" />
                        <strong>{voice.label}</strong>
                      </div>
                      <span className="lib-row-detail">{voice.persona}</span>
                    </div>
                  ))}
                </div>

                <div className="library-stack-card">
                  <h3 className="library-col-title">Subtitle Styles</h3>
                  <div className="subtitle-chips">
                    {subtitlePresetCatalog.slice(0, 6).map((preset) => (
                      <span className="subtitle-chip" key={preset.id}>
                        {preset.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="library-stack-card">
                  <h3 className="library-col-title">Visual Packs</h3>
                  {assetPackCatalog.map((pack) => (
                    <div className="lib-row" key={pack.id}>
                      <div className="lib-row-left">
                        <span className="lib-row-dot" />
                        <strong>{pack.label}</strong>
                      </div>
                      <span className="lib-row-detail">{pack.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="cta-section reveal-on-scroll">
          <div className="cta-container">
            <div className="cta-orb" aria-hidden="true" />
            <span className="section-tag">Ready?</span>
            <h2>Your next viral reel is<br />one idea away.</h2>
            <div className="cta-actions">
              <Link href="/editor" className="hero-primary-btn">
                <span>Start creating</span>
                <span className="btn-arrow">→</span>
              </Link>
              <Link href="/dashboard" className="hero-secondary-btn">
                Open dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="landing-footer">
          <div className="footer-inner">
            <span className="footer-brand">Brainclip</span>
            <span className="footer-copy">© {new Date().getFullYear()} · Built for creators who move fast.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
