"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { duoPresets, subtitlePresetCatalog, voicePresetCatalog, assetPackCatalog } from "@/lib/catalog";

/* ─── Data ─── */

const pillars = [
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
    title: "Duo Dialogue",
    body: "Two AI voices in conversation. Formats engineered for retention.",
    accent: "var(--accent)",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" x2="12" y1="19" y2="22"></line>
      </svg>
    ),
    title: "Voice Studio",
    body: "Expressive voice packs or your own clone. Fully timed and tuned.",
    accent: "var(--sky)",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    ),
    title: "1-Click Export",
    body: "HD vertical reels rendered in the cloud. Ready to post instantly.",
    accent: "var(--accent-deep)",
  },
];

const stats = [
  { value: "60s", label: "Length", icon: "⏱" },
  { value: "720p", label: "Quality", icon: "📺" },
  { value: "8+", label: "Voices", icon: "🎤" },
  { value: "∞", label: "Ideas", icon: "💡" },
];

const steps = [
  { title: "Describe idea", body: "Type a topic. We write the script." },
  { title: "Pick format", body: "Debate, explainer, or host-guest." },
  { title: "Choose style", body: "Select voices and subtitle effects." },
  { title: "Render & post", body: "Get your polished vertical reel." },
];

const socialProof = [
  { metric: "10x", label: "Faster" },
  { metric: "$0", label: "Free tier" },
  { metric: "< 3m", label: "To first reel" },
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

/* ─── Hero Video Component ─── */

function HeroVideo() {
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div 
      className="hero-demo-video" 
      style={{ 
        position: "relative", 
        width: "100%", 
        maxWidth: "320px", 
        margin: "0 auto", 
        borderRadius: "36px", 
        overflow: "hidden", 
        boxShadow: "0 32px 80px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(0,0,0,0.05)",
        border: "8px solid #fcfbf9",
        background: "#000",
      }}
    >
      <video 
        ref={videoRef}
        src="https://brainclips-videos.s3.us-east-1.amazonaws.com/final.mp4" 
        autoPlay 
        muted 
        loop 
        playsInline
        style={{ width: "100%", display: "block", aspectRatio: "9/16", objectFit: "cover" }}
      />

      {/* Dynamic island mockup for 'Vertical Reel' feel */}
      <div style={{ position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)", width: "96px", height: "28px", background: "#000", borderRadius: "14px", zIndex: 10 }}></div>

      <button 
        onClick={toggleMute}
        style={{
          position: "absolute",
          bottom: "24px",
          right: "20px",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "50%",
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          fontSize: "1.2rem",
          transition: "transform 150ms ease, background 150ms ease",
          zIndex: 10
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.background = "rgba(0,0,0,0.8)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(0,0,0,0.6)"; }}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? "🔇" : "🔊"}
      </button>
    </div>
  );
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
            <div className="hero-content">
              <div className="hero-badge animate-hero">
                <span className="badge-dot" />
                AI-Powered Reel Creator
              </div>

              <h1 className="hero-title animate-hero delay-1">
                Turn any idea into<br />
                <span className="hero-gradient-text">addictive reels.</span>
              </h1>

              <p className="hero-subtitle animate-hero delay-2">
                Type an idea. Pick a format. Get a scroll-stopping short in minutes. No editing required.
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

            <div className="hero-visual animate-hero delay-4">
              <HeroVideo />
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
