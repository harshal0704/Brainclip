"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import "./login.css";

const features = [
  { icon: "✨", label: "AI Script Generation", desc: "Smart dialogues in seconds" },
  { icon: "🎙️", label: "Voice Cloning", desc: "Realistic AI voices" },
  { icon: "🎬", label: "HD Video Export", desc: "720p vertical reels" },
];

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-shapes">
        <div className="login-shape login-shape-1" />
        <div className="login-shape login-shape-2" />
        <div className="login-shape login-shape-3" />
      </div>

      <nav className="login-nav">
        <div className="login-nav-brand">
          <div className="login-nav-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
              <path d="M16 8C11.58 8 8 11.58 8 16s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" fill="#fff" />
              <path d="M16 12v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#bb5b32" />
                  <stop offset="1" stopColor="#8c4122" />
                </linearGradient>
              </defs>
            </svg>
            <span>Brainclip</span>
          </div>
        </div>
        <Link href="/" className="login-nav-cta">
          Try free
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </nav>

      <main className="login-main">
        <div className={`login-card ${isMounted ? "mounted" : ""}`}>
          <div className="login-logo-section">
            <div className="login-logo-icon">
              <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#logoGrad2)" />
                <path d="M16 8C11.58 8 8 11.58 8 16s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" fill="#fff" />
                <path d="M16 12v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="logoGrad2" x1="0" y1="0" x2="32" y2="32">
                    <stop stopColor="#bb5b32" />
                    <stop offset="1" stopColor="#8c4122" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="login-headline">
            <h1>Create Viral Reels<br />in Minutes</h1>
            <p>AI-powered dual-voice video generator for content creators</p>
          </div>

          <div className="login-benefits">
            {features.map((feature) => (
              <div className="login-benefit" key={feature.label}>
                <span className="login-benefit-icon">{feature.icon}</span>
                <div className="login-benefit-text">
                  <strong>{feature.label}</strong>
                  <span>{feature.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="login-divider">
            <span>Get started free</span>
          </div>

          <button
            className={`login-button ${isLoading ? "loading" : ""}`}
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="login-spinner" />
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <p className="login-terms">
            By continuing, you agree to our{" "}
            <a href="#">Terms of Service</a> and{" "}
            <a href="#">Privacy Policy</a>
          </p>

          <div className="login-trust">
            <div className="login-trust-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Secure authentication</span>
            </div>
            <div className="login-trust-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>No credit card required</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="login-footer">
        <p>Free forever for creators · Made with AI</p>
      </footer>
    </div>
  );
}
