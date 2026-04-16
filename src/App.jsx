import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { cityContent, cityOrder } from "./content/cities";
import { createWaveBlob } from "./lib/audio";
import { MapPage } from "./MapPage";

const audioContext = typeof window !== "undefined" ? new (window.AudioContext || window.webkitAudioContext)() : null;

export default function App() {
  const [lang, setLang] = useState("zh");

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/city/${cityOrder[0]}`} replace />} />
      <Route path="/city/:citySlug" element={<CityRoute lang={lang} onToggleLanguage={() => startTransition(() => setLang((current) => (current === "zh" ? "en" : "zh")))} />} />
      <Route path="/map" element={<MapRoute lang={lang} onToggleLanguage={() => startTransition(() => setLang((current) => (current === "zh" ? "en" : "zh")))} />} />
      <Route path="*" element={<Navigate to={`/city/${cityOrder[0]}`} replace />} />
    </Routes>
  );
}

function CityRoute({ lang, onToggleLanguage }) {
  const { citySlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const city = cityContent[citySlug];

  useEffect(() => {
    if (!city) navigate(`/city/${cityOrder[0]}`, { replace: true });
  }, [city, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!city) return null;

  return <CityPage city={city} lang={lang} onToggleLanguage={onToggleLanguage} />;
}

function MapRoute({ lang, onToggleLanguage }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return <MapPage lang={lang} onToggleLanguage={onToggleLanguage} navigate={navigate} />;
}

function CityPage({ city, lang, onToggleLanguage }) {
  const navigate = useNavigate();
  const content = city.text[lang];
  const [headerVisible, setHeaderVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollRef = useRef(0);
  const rafRef = useRef(0);
  const bgAudioRef = useRef(null);
  const panelRef = useRef(null);
  const spectrumCanvasRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const sheetAudioRef = useRef(null);
  const objectUrlRef = useRef({ background: null, sheet: null });
  const sceneRefs = useRef([]);
  const layerRefs = useRef([]);
  const hotspotRefs = useRef([]);

  const hotspotLookup = useMemo(
    () => content.scenes.flatMap((scene) => scene.hotspots),
    [content.scenes]
  );

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = lang === "zh" ? `${content.title} | 城市声景` : `${content.title} | City Soundscape`;
  }, [content.title, lang]);

  useEffect(() => {
    if (!bgAudioRef.current) return undefined;
    const element = bgAudioRef.current;
    if (objectUrlRef.current.background) URL.revokeObjectURL(objectUrlRef.current.background);
    const source = city.backgroundSound.src
      ? city.backgroundSound.src
      : URL.createObjectURL(createWaveBlob(city.backgroundSound, { duration: 24, gain: 0.22 }));
    objectUrlRef.current.background = city.backgroundSound.src ? null : source;
    element.src = source;
    element.volume = 0.4;
    element.muted = muted;
    const attempt = element.play();
    if (attempt?.catch) {
      attempt.catch(() => setMuted(true));
    }
    return () => {
      element.pause();
      if (objectUrlRef.current.background) {
        URL.revokeObjectURL(objectUrlRef.current.background);
        objectUrlRef.current.background = null;
      }
    };
  }, [city, muted]);

  useEffect(() => {
    const element = bgAudioRef.current;
    if (!element) return;
    element.muted = muted;
    if (muted) {
      element.pause();
      return;
    }
    element.play().catch(() => undefined);
  }, [muted]);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const current = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? current / max : 0);
        if (current > scrollRef.current + 8 && current > 120) setHeaderVisible(false);
        if (current < scrollRef.current - 8 || current < 48) setHeaderVisible(true);
        scrollRef.current = current;

        layerRefs.current.forEach((layer) => {
          if (!layer) return;
          const speed = Number(layer.dataset.speed || 0);
          const owner = layer.closest("[data-parallax-owner]");
          const offset = owner?.getBoundingClientRect().top ?? 0;
          // 增强视差系数至 0.35 以获得更明显的效果
          const yTransform = (current + offset) * speed * -0.35;
          layer.style.transform = `translate3d(0, ${yTransform}px, 0)`;
        });

        sceneRefs.current.forEach((scene) => {
          if (!scene) return;
          const rect = scene.getBoundingClientRect();
          const viewportProgress = clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1);
          scene.querySelectorAll("[data-hotspot-threshold]").forEach((button) => {
            const threshold = Number(button.dataset.hotspotThreshold || 0.3);
            button.classList.toggle("is-visible", viewportProgress > threshold);
          });
        });
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [content.scenes]);

  useEffect(() => {
    if (!sheetOpen || !activeHotspot || !sheetAudioRef.current || !audioContext) return undefined;
    const audio = sheetAudioRef.current;
    if (objectUrlRef.current.sheet) URL.revokeObjectURL(objectUrlRef.current.sheet);
    const src = activeHotspot.audio
      ? activeHotspot.audio
      : URL.createObjectURL(createWaveBlob(activeHotspot.sound, { duration: 12, gain: 0.55, offset: 0.13 }));
    objectUrlRef.current.sheet = activeHotspot.audio ? null : src;
    audio.src = src;
    audio.volume = 0.85;

    if (!analyserRef.current) {
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.86;
    }
    if (!sourceRef.current) {
      sourceRef.current = audioContext.createMediaElementSource(audio);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") audioContext.resume().catch(() => undefined);
    audio.play().catch(() => undefined);

    let frame = 0;
    const ctx = spectrumCanvasRef.current?.getContext("2d");
    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!ctx) return;
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, 720, 240);
      const barWidth = (720 / data.length) * 1.6;
      data.forEach((value, index) => {
        const height = (value / 255) * 240;
        const x = index * barWidth;
        const gradient = ctx.createLinearGradient(0, 240, 0, 240 - height);
        gradient.addColorStop(0, "rgba(136, 224, 255, 0.18)");
        gradient.addColorStop(0.65, "rgba(136, 224, 255, 0.85)");
        gradient.addColorStop(1, "rgba(244, 191, 101, 0.95)");
        ctx.fillStyle = gradient;
        ctx.fillRect(x, 240 - height, Math.max(barWidth - 2, 2), height);
      });
    };
    draw();

    return () => {
      cancelAnimationFrame(frame);
      audio.pause();
      if (objectUrlRef.current.sheet) {
        URL.revokeObjectURL(objectUrlRef.current.sheet);
        objectUrlRef.current.sheet = null;
      }
    };
  }, [activeHotspot, sheetOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSheetOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onPointerDown = (event) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (!panel.contains(event.target)) {
        setSheetOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sheetOpen]);

  const openHotspot = (hotspot) => {
    setActiveHotspot(hotspot);
    setSheetOpen(true);
  };

  const goToCity = (slug) => navigate(`/city/${slug}`);

  return (
    <div className="page-shell">
      <audio ref={bgAudioRef} loop playsInline />

      <header className={`site-header ${headerVisible ? "" : "is-hidden"}`}>
        <div className="brand-lockup">
          <span className="brand-cn">{lang === "zh" ? "城市声景" : "CITY"}</span>
          <span className="brand-en">{lang === "zh" ? "City Soundscape" : "Urban Acoustic Narrative"}</span>
        </div>
        <nav className="city-nav" aria-label="City navigation">
          <button className="city-link" onClick={() => navigate("/map")} title={lang === "zh" ? "全景" : "Panorama"}>
            {lang === "zh" ? "全景" : "PANORAMA"}
          </button>
          {cityOrder.map((slug) => (
            <button key={slug} className={`city-link ${slug === city.slug ? "is-active" : ""}`} onClick={() => goToCity(slug)}>
              {cityContent[slug].text[lang].nav}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="audio-toggle"
            aria-pressed={muted}
            onClick={() => {
              if (audioContext?.state === "suspended") audioContext.resume().catch(() => undefined);
              setMuted((current) => !current);
            }}
          >
            {muted ? (lang === "zh" ? "开启声音" : "Sound On") : lang === "zh" ? "静音" : "Mute"}
          </button>
          <button className="lang-toggle" onClick={onToggleLanguage}>
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>

      <aside className="progress-shell" aria-label="Page progress">
        <span className="progress-label">00</span>
        <div className="progress-track">
          <div className="progress-fill" style={{ transform: `scaleY(${progress})` }} />
        </div>
        <span className="progress-label">100</span>
      </aside>

      <main>
        <section className="hero" style={{ "--hero-image": city.heroImage, "--cover-image": `url(${city.coverImage})` }} data-parallax-owner>
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="eyebrow">{content.eyebrow}</span>
              <h1 className="hero-title" data-speed="0.18" ref={(node) => storeRef(layerRefs, node)}>{content.title}</h1>
              <p className="hero-subtitle" data-speed="0.28" ref={(node) => storeRef(layerRefs, node)}>{content.subtitle}</p>
            </div>
            <aside className="hero-side" data-speed="0.12" ref={(node) => storeRef(layerRefs, node)}>
              <p className="hero-side-title">{content.sideTitle}</p>
              {content.stats.map(([label, value]) => (
                <div className="hero-stat" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </aside>
          </div>
        </section>

        {content.scenes.map((scene, sceneIndex) => (
          <section
            className="scene"
            key={scene.index}
            data-parallax-owner
            ref={(node) => {
              sceneRefs.current[sceneIndex] = node;
            }}
            style={{ "--scene-gradient": city.palette[sceneIndex % city.palette.length] }}
          >
            <div className="scene-backdrop" data-speed="0.15" ref={(node) => storeRef(layerRefs, node)} />
            <div className="scene-glow" data-speed="0.42" ref={(node) => storeRef(layerRefs, node)} />
            <div className="scene-grid">
              <div className="scene-meta" data-speed="0.06" ref={(node) => storeRef(layerRefs, node)}>
                <span className="scene-index">{scene.index}</span>
                <span className="scene-subtitle">{scene.subtitle}</span>
              </div>
              <div className="scene-body">
                <h2 className="scene-title" data-speed="0.18" ref={(node) => storeRef(layerRefs, node)}>{scene.title}</h2>
                <p className="scene-description" data-speed="0.28" ref={(node) => storeRef(layerRefs, node)}>{scene.description}</p>
              </div>
              <div className="hotspot-cluster">
                {scene.hotspots.map((hotspot, hotspotIndex) => (
                  <button
                    key={hotspot.id}
                    className="hotspot-button"
                    style={{ left: hotspot.x, top: hotspot.y }}
                    data-hotspot-threshold={0.26 + hotspotIndex * 0.08}
                    ref={(node) => storeRef(hotspotRefs, node)}
                    onClick={() => openHotspot(hotspotLookup.find((item) => item.id === hotspot.id))}
                  >
                    {hotspot.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ))}

        <div className="footer-note">{content.footer}</div>
      </main>

      <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        {lang === "zh" ? "顶部" : "TOP"}
      </button>

      <section className={`info-sheet ${sheetOpen ? "is-open" : ""}`} aria-hidden={!sheetOpen}>
        <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} />
        <div className="sheet-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <button className="sheet-close" onClick={() => setSheetOpen(false)} aria-label="Close">×</button>
          {activeHotspot && (
            <div className="sheet-content">
              <div className="sheet-copy">
                <span className="sheet-kicker">{activeHotspot.kicker}</span>
                <h2 id="sheet-title">{activeHotspot.title}</h2>
                <p className="sheet-text">{activeHotspot.text}</p>
                <audio ref={sheetAudioRef} className="sheet-audio" controls preload="metadata" />
              </div>
              <div className="sheet-media">
                <img className="sheet-image" src={activeHotspot.image} alt={activeHotspot.title} />
                <canvas className="spectrum" ref={spectrumCanvasRef} width="720" height="240" aria-label="Audio spectrum" />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function storeRef(ref, node) {
  if (!node) return;
  if (!ref.current.includes(node)) ref.current.push(node);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
