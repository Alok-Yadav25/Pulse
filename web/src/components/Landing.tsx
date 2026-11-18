import { useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Fingerprint,
  Globe2,
  Layers3,
  Radio,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Logo } from "./brand";
import "../landing.css";

const signals = {
  uptime: {
    label: "Uptime",
    value: "99.98",
    unit: "%",
    caption: "Every heartbeat accounted for.",
    color: "#d3ff7a",
  },
  latency: {
    label: "Performance",
    value: "142",
    unit: "ms",
    caption: "Every millisecond, in focus.",
    color: "#b5a0ff",
  },
  visitors: {
    label: "Visitors",
    value: "248",
    unit: "active",
    caption: "Real people. Right now.",
    color: "#ffab96",
  },
};
type Signal = keyof typeof signals;

/** A lightweight vector signal sculpture. Decorative motion never implies probe regions. */
function SignalOrb({ tone }: { tone: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="signal-orb" viewBox="0 0 620 620" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-core`} cx="35%" cy="25%" r="85%">
          <stop stopColor="#9c7dff" />
          <stop offset=".38" stopColor="#5535bd" />
          <stop offset=".76" stopColor="#211049" />
          <stop offset="1" stopColor="#090717" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="#8757ff" stopOpacity=".45" />
          <stop offset="1" stopColor="#8757ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-ring`} x2="1" y2="1">
          <stop stopColor={tone} />
          <stop offset=".45" stopColor="#b99dff" />
          <stop offset="1" stopColor="#7852d4" stopOpacity=".1" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="310" cy="310" r="169" />
        </clipPath>
      </defs>
      <circle cx="310" cy="310" r="300" fill={`url(#${id}-halo)`} />
      <g className="orb-guides" fill="none" stroke="#b89fff">
        <circle
          cx="310"
          cy="310"
          r="258"
          strokeDasharray="2 10"
          opacity=".24"
        />
        <circle cx="310" cy="310" r="220" opacity=".13" />
        <path d="M310 26V68M310 552V594M26 310H68M552 310H594" opacity=".35" />
      </g>
      <g
        className="orb-orbit-back"
        fill="none"
        stroke={`url(#${id}-ring)`}
        strokeWidth="1.2"
      >
        <ellipse
          cx="310"
          cy="310"
          rx="284"
          ry="100"
          transform="rotate(-34 310 310)"
        />
        <ellipse
          cx="310"
          cy="310"
          rx="265"
          ry="114"
          transform="rotate(46 310 310)"
          opacity=".48"
        />
      </g>
      <circle
        cx="310"
        cy="310"
        r="171"
        fill={`url(#${id}-core)`}
        stroke="#b7a0ff"
        strokeOpacity=".45"
      />
      <g
        clipPath={`url(#${id}-clip)`}
        fill="none"
        stroke="#cebaff"
        strokeWidth=".7"
        opacity=".28"
      >
        {[-120, -80, -40, 0, 40, 80, 120].map((v) => (
          <ellipse
            key={v}
            cx="310"
            cy={310 + v}
            rx={Math.sqrt(169 ** 2 - v ** 2)}
            ry={24 + (169 - Math.abs(v)) * 0.09}
          />
        ))}
        {[24, 60, 104, 145].map((v) => (
          <ellipse
            key={v}
            cx="310"
            cy="310"
            rx={v}
            ry="169"
            transform="rotate(-23 310 310)"
          />
        ))}
        <path d="M138 310H482" />
      </g>
      <circle
        cx="310"
        cy="310"
        r="91"
        fill="#17102cd9"
        stroke="#d9caff"
        strokeOpacity=".22"
      />
      <circle
        cx="310"
        cy="310"
        r="77"
        fill="#ffffff04"
        stroke="#d9caff"
        strokeOpacity=".08"
      />
      <g
        className="orb-heartbeat"
        style={{ strokeDasharray: "none", strokeDashoffset: 0 }}
      >
        <circle cx="310" cy="310" r="58" fill="#403BAA" />
        <g fill="#FFE1EA">
          <circle cx="270" cy="310" r="5.8" />
          <circle cx="350" cy="310" r="5.8" />
        </g>
        <g
          fill="none"
          stroke="#FFE1EA"
          strokeWidth="11.2"
          strokeLinecap="round"
        >
          <path d="M297 286 283 323" />
          <path d="M321 275 297 345" />
          <path d="M334 302 323 331" />
        </g>
      </g>
      <g className="orb-satellite" style={{ transformOrigin: "310px 310px" }}>
        <circle cx="310" cy="52" r="5" fill={tone} />
        <circle cx="310" cy="52" r="12" fill={tone} opacity=".12" />
        <circle cx="310" cy="568" r="3" fill="#c2a7ff" />
      </g>
      <g fill={tone}>
        <circle cx="98" cy="390" r="5" />
        <circle cx="493" cy="173" r="4" />
        <circle cx="461" cy="475" r="3" />
      </g>
      <path
        d="M83 402C192 377 376 245 547 188"
        fill="none"
        stroke={`url(#${id}-ring)`}
        strokeWidth="1.4"
        className="orb-transmission"
      />
    </svg>
  );
}

function MiniTrace({
  color = "#d3ff7a",
  id = "trace",
}: {
  color?: string;
  id?: string;
}) {
  const path =
    "M0 66C18 65 18 46 36 49S62 64 78 54S102 37 118 43S136 67 152 55S170 36 188 41S207 51 220 35S235 7 250 31S268 56 285 42S307 24 325 33S346 49 361 37S384 24 400 29";
  return (
    <svg
      className="mini-trace"
      viewBox="0 0 400 90"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x2="0" y2="1">
          <stop stopColor={color} stopOpacity=".25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path}V90H0Z`} fill={`url(#${id})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function Landing({ onAdd }: { onAdd: () => void }) {
  const [signal, setSignal] = useState<Signal>("uptime");
  const [phase, setPhase] = useState(3);
  const current = signals[signal];
  const phases = [
    { name: "DNS", ms: 8, color: "#b5a0ff" },
    { name: "TCP", ms: 24, color: "#76d5ff" },
    { name: "TLS", ms: 35, color: "#ffab96" },
    { name: "TTFB", ms: 75, color: "#d3ff7a" },
  ];
  return (
    <div className="landing studio-landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="landing-ambient" aria-hidden="true" />
      <nav className="landing-nav" aria-label="Main navigation">
        <Link to="/" aria-label="Pulse home">
          <Logo />
        </Link>
        <div className="landing-nav-links">
          <a href="#signal">The signal</a>
          <a href="#inside">Inside Pulse</a>
          <Link to="/docs">
            Docs <ArrowUpRight size={12} />
          </Link>
        </div>
        <Link to="/dashboard" className="landing-nav-cta">
          Open dashboard <ArrowUpRight size={16} />
        </Link>
      </nav>
      <main id="main-content" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="hero-heading">
          <div className="hero-copy hero-reveal">
            <span className="landing-chip">
              <span className="signal-live-dot" /> YOUR WEB. ONE FREQUENCY.
            </span>
            <h1 id="hero-heading">
              Stay ahead.
              <br />
              <span className="hero-gradient">Stay in pulse.</span>
              <span className="hero-asterisk" aria-hidden="true">
                ✳
              </span>
            </h1>
            <p>
              Uptime. Speed. People.
              <br />
              Every signal. One extraordinary view.
            </p>
            <div className="landing-cta">
              <button onClick={onAdd} className="hero-primary">
                Start monitoring{" "}
                <span>
                  <ArrowUpRight size={20} />
                </span>
              </button>
              <Link to="/dashboard" className="landing-demo">
                Explore the demo <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-fine">
              <span>
                <Check size={13} /> No credit card
              </span>
              <span>
                <Fingerprint size={13} /> Privacy by design
              </span>
            </div>
            <a className="hero-scroll" href="#signal">
              <span>
                <ArrowDown size={14} />
              </span>{" "}
              FOLLOW THE SIGNAL
            </a>
          </div>
          <div
            className="hero-scene"
            onPointerMove={(event) => {
              if (
                event.pointerType !== "mouse" ||
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
              )
                return;
              const box = event.currentTarget.getBoundingClientRect();
              event.currentTarget.style.setProperty(
                "--tilt-x",
                `${((event.clientX - box.left) / box.width - 0.5) * 9}deg`,
              );
              event.currentTarget.style.setProperty(
                "--tilt-y",
                `${(0.5 - (event.clientY - box.top) / box.height) * 9}deg`,
              );
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.setProperty("--tilt-x", "0deg");
              event.currentTarget.style.setProperty("--tilt-y", "0deg");
            }}
            style={{ "--signal-tone": current.color } as React.CSSProperties}
          >
            <div className="scene-coordinate coord-top">
              <span className="crosshair">+</span> PULSE / SIGNAL OBSERVATORY
            </div>
            <SignalOrb tone={current.color} />
            <div className="scene-status">
              <span className="signal-live-dot" /> SYSTEMS IN SYNC{" "}
              <span className="status-ticks">▏▏▏▏▏▏▏▏</span>
            </div>
            <div className="floating-stat floating-stat-main">
              <div>
                <span className="stat-icon">
                  <Activity size={15} />
                </span>
                <span>{current.label}</span>
                <span className="signal-sample">DEMO</span>
              </div>
              <strong key={signal} className="stat-reveal">
                {current.value}
                <small>{current.unit}</small>
              </strong>
              <MiniTrace color={current.color} id="hero-trace" />
              <p>{current.caption}</p>
            </div>
            <div className="floating-stat floating-stat-note">
              <span className="note-status">
                <ShieldCheck size={17} /> All clear
              </span>
              <span>example.com</span>
              <div className="note-bars">
                {Array.from({ length: 26 }, (_, i) => (
                  <i key={i} style={{ opacity: 0.4 + (i % 5) * 0.12 }} />
                ))}
              </div>
              <span>
                LAST 24H <b>99.98%</b>
              </span>
            </div>
            <div className="scene-bottom">
              <span>01 — THE LIVING WEB</span>
              <span>
                ILLUSTRATIVE SIGNALS <span className="crosshair">+</span>
              </span>
            </div>
          </div>
        </section>
        <div className="signal-selector" aria-label="Explore sample signals">
          <span className="selector-caption">
            ONE WORKSPACE.
            <br />
            <strong>Every dimension.</strong>
          </span>
          <div>
            {(Object.keys(signals) as Signal[]).map((key, i) => (
              <button
                key={key}
                onClick={() => setSignal(key)}
                aria-label={signals[key].label}
                aria-pressed={signal === key}
                className={signal === key ? "selected" : ""}
              >
                <span className="selector-index">0{i + 1}</span>
                {signals[key].label}
                {key === "uptime" ? (
                  <Radio size={20} />
                ) : key === "latency" ? (
                  <Zap size={20} />
                ) : (
                  <Globe2 size={20} />
                )}
              </button>
            ))}
          </div>
          <a
            href="#signal"
            className="selector-next"
            aria-label="Explore the signal"
          >
            <ArrowDown size={20} />
          </a>
        </div>
        <section id="signal" className="signal-section">
          <div className="section-intro">
            <span className="landing-kicker">LESS NOISE. MORE KNOWING.</span>
            <h2>
              The details matter.
              <br />
              <span>See them differently.</span>
            </h2>
            <p>
              A clear view of what’s working.
              <br />
              And what needs your attention.
            </p>
          </div>
          <div className="signal-bento" id="inside">
            <article className="signal-performance">
              <div className="feature-top">
                <span>
                  <Zap size={15} /> PERFORMANCE, UNDER THE SURFACE
                </span>
                <ArrowUpRight size={19} />
              </div>
              <div className="performance-copy">
                <h3>
                  Not just fast.
                  <br />
                  <em>Know why.</em>
                </h3>
                <span className="feature-demo">
                  SAMPLE REQUEST <span /> 142 ms
                </span>
              </div>
              <div className="landing-trace">
                <div className="trace-grid" />
                <MiniTrace color="#b5a0ff" id="performance-trace" />
                <span className="trace-mark">
                  142 <small>ms</small>
                </span>
              </div>
              <div
                className="request-phases"
                aria-label="Explore sample request phases"
              >
                {phases.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => setPhase(i)}
                    aria-label={`${p.name}: ${p.ms} milliseconds`}
                    aria-pressed={phase === i}
                    style={
                      {
                        "--phase-color": p.color,
                        "--phase-size": `${(p.ms / 142) * 100}%`,
                      } as React.CSSProperties
                    }
                  >
                    <span>
                      <i />
                      {p.name}
                    </span>
                    <strong>
                      {p.ms}
                      <small>ms</small>
                    </strong>
                    <i className="phase-line" />
                  </button>
                ))}
              </div>
              <p className="phase-caption" aria-live="polite">
                {phases[phase].name} <span>/</span>{" "}
                {
                  [
                    "Finding the address.",
                    "Opening the connection.",
                    "Securing the handshake.",
                    "Waiting for the first byte.",
                  ][phase]
                }
              </p>
            </article>
            <article className="signal-people">
              <div className="feature-top">
                <span>
                  <Fingerprint size={15} /> PEOPLE, NOT PROFILES
                </span>
                <ArrowUpRight size={19} />
              </div>
              <div className="people-visual" aria-hidden="true">
                <div className="people-orbit people-orbit-1" />
                <div className="people-orbit people-orbit-2" />
                <div className="people-orbit people-orbit-3" />
                <div className="people-center">
                  <Globe2 size={34} strokeWidth={1} />
                </div>
                {Array.from({ length: 15 }, (_, i) => (
                  <span
                    className="people-node"
                    key={i}
                    style={
                      {
                        "--angle": `${i * 137.5}deg`,
                        "--distance": `${55 + (i % 4) * 25}px`,
                        "--delay": `${i * -0.7}s`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
              <h3>A human perspective.</h3>
              <p>Visitor analytics. Zero cookies.</p>
              <div className="people-footer">
                <span>
                  <span className="signal-live-dot" /> LIVE VISITORS{" "}
                  <strong>248</strong>
                </span>
                <span
                  className="people-bars"
                  role="img"
                  aria-label="Illustrative visitor distribution"
                >
                  {[22, 40, 32, 65, 48, 80, 62, 93, 76, 100, 85, 69].map(
                    (h, i) => (
                      <i key={i} style={{ height: `${h}%` }} />
                    ),
                  )}
                </span>
              </div>
              <span className="feature-disclosure">Illustrative preview</span>
            </article>
          </div>
          <div className="signal-flow">
            <span>
              <Code2 size={18} /> Your website
            </span>
            <i />
            <span className="flow-pulse">
              <Layers3 size={18} /> Pulse
            </span>
            <i />
            <span>
              <Zap size={18} /> Your next move
            </span>
            <Link to="/docs">
              See how it connects <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        <section className="landing-finale">
          <div>
            <span className="landing-kicker">KEEP THE BIG PICTURE.</span>
            <h2>
              Small snippet.
              <br />
              <span>Big perspective.</span>
            </h2>
          </div>
          <button
            onClick={onAdd}
            className="finale-cta"
            aria-label="Start monitoring your website"
          >
            <ArrowUpRight size={44} />
          </button>
          <span className="finale-note">
            Your next clear view
            <br />
            starts with a URL.
          </span>
        </section>
      </main>
      <footer className="landing-footer">
        <Link to="/" aria-label="Pulse home">
          <Logo />
        </Link>
        <span>THE WEB MOVES. STAY IN PULSE.</span>
        <div>
          <Link to="/privacy">Privacy</Link>
          <Link to="/docs">
            Documentation <ArrowUpRight size={12} />
          </Link>
        </div>
        <a href="#hero-heading" className="back-top" aria-label="Back to top">
          <ChevronRight size={16} />
        </a>
      </footer>
    </div>
  );
}
