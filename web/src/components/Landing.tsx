import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  HeartPulse,
  Users,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { Logo, StatusDot } from "./brand";
import "../landing.css";
export default function Landing({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <nav className="landing-nav">
        <Link to="/welcome">
          <Logo />
        </Link>
        <div>
          <a href="#features">Why Pulse</a>
          <Link to="/docs">Documentation</Link>
          <Link to="/" className="button button-secondary">
            Open dashboard
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </nav>
      <main id="main-content" tabIndex={-1}>
        <section className="landing-hero">
          <div className="hero-reveal">
            <span className="landing-chip">
              <span className="tiny-dot" />A CLEARER PICTURE OF YOUR WEB
            </span>
            <h1>
              Big on signals.
              <br />
              <span>Easy on your mind.</span>
            </h1>
            <p>
              Your uptime, performance, and visitors. Together in one
              beautifully calm workspace.
            </p>
            <div className="landing-cta">
              <button onClick={onAdd} className="button button-primary">
                Add your first website
                <ArrowRight size={16} />
              </button>
              <Link to="/" className="landing-demo">
                Explore the demo
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <span className="landing-fine">
              <ShieldCheck size={13} />
              Privacy first. Lightweight by design.
            </span>
          </div>
          <div className="hero-preview">
            <div className="hero-preview-head">
              <Logo small />
              <span>acme.com</span>
              <span className="status-label operational">
                <StatusDot pulse />
                Operational
              </span>
            </div>
            <div className="hero-preview-value">
              <span>RESPONSE TIME</span>
              <strong className="mono">
                142<small>ms</small>
              </strong>
              <span className="hero-value-caption">
                A healthy little heartbeat.
              </span>
            </div>
            <svg
              viewBox="0 0 600 100"
              className="heartbeat-svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="heart-gradient">
                  <stop stopColor="#93d8ac" stopOpacity="0" />
                  <stop offset=".45" stopColor="#b9f6ce" />
                  <stop offset="1" stopColor="#93d8ac" stopOpacity=".2" />
                </linearGradient>
              </defs>
              <path
                d="M0 60H170L185 48 200 60H245L263 85 286 10 310 91 329 40 343 60H600"
                fill="none"
                stroke="url(#heart-gradient)"
                strokeWidth="2"
              />
            </svg>
            <div className="hero-preview-bottom">
              <span>
                <StatusDot />
                Illustrative demo
              </span>
              <span>99.99% uptime</span>
            </div>
          </div>
        </section>
        <section id="features" className="landing-features">
          {[
            {
              icon: HeartPulse,
              title: "Every heartbeat, accounted for.",
              text: "See uptime and response times without digging through the noise.",
            },
            {
              icon: Users,
              title: "Real people. Clear insights.",
              text: "Understand your visitors with lightweight, cookie-free analytics.",
            },
            {
              icon: Radio,
              title: "Keep everyone in the loop.",
              text: "A beautiful status page that gives your users peace of mind.",
            },
          ].map(({ icon: Icon, title, text }, i) => (
            <article key={title}>
              <span className="feature-number mono">0{i + 1}</span>
              <Icon size={26} strokeWidth={1.2} />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <span>A little more peace of mind.</span>
        <Link to="/privacy">Privacy</Link>
        <Link to="/docs">
          Explore Pulse
          <ArrowUpRight size={12} />
        </Link>
      </footer>
    </div>
  );
}
