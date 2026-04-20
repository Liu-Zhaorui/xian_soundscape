import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { cityContent, cityOrder } from "./content/cities";
import { createWaveBlob } from "./lib/audio";
import places from "./content/places.json";
import { MapPage } from "./MapPage";
import { AboutPage } from "./AboutPage";
import { SoundwalkPage } from "./SoundwalkPage";
import { Footer } from "./Footer";
import { VideoIntro } from "./VideoIntro";
import rms151Url from "./content/img/acoustics/1-15RMS.html?url";
import rms1633Url from "./content/img/acoustics/16-33RMS.html?url";
import lufs151Url from "./content/img/acoustics/1-15LUFS.html?url";
import lufs1633Url from "./content/img/acoustics/16-33LUFS.html?url";

const imageAssets = import.meta.glob("./content/img/typical/*.{jpg,JPG,png,jpeg}", { as: "url", eager: true });
const audioAssets = import.meta.glob("./content/audio/*.wav", { as: "url", eager: true });

const normalizeAssetName = (path) => path.split(/[/\\\\]/).pop().toLowerCase();
const imageUrls = Object.fromEntries(
  Object.entries(imageAssets).map(([path, url]) => [normalizeAssetName(path), url])
);
const audioUrls = Object.fromEntries(
  Object.entries(audioAssets).map(([path, url]) => [normalizeAssetName(path), url])
);

const resolveAssetUrl = (name) => {
  if (!name) return null;
  const key = name.toLowerCase();
  if (imageUrls[key]) return imageUrls[key];
  const base = key.replace(/\.[^.]+$/, "");
  return imageUrls[`${base}.jpg`] || imageUrls[`${base}.jpeg`] || imageUrls[`${base}.png`] || null;
};

const resolveAudioUrl = (name) => {
  if (!name) return null;
  const key = name.toLowerCase();
  if (audioUrls[key]) return audioUrls[key];
  const base = key.replace(/\.[^.]+$/, "");
  return audioUrls[`${base}.wav`] || null;
};

const audioContext = typeof window !== "undefined" ? new (window.AudioContext || window.webkitAudioContext)() : null;

export default function App() {
  const [lang, setLang] = useState("zh");
  const [bgMuted, setBgMuted] = useState(true);
  const [showIntro, setShowIntro] = useState(() => {
    return sessionStorage.getItem("introWatched") !== "true";
  });
  const location = useLocation();

  const isMapPage = location.pathname === '/map';

  const isSoundwalkPage = location.pathname === '/soundwalk';

  const handleIntroComplete = () => {
    setShowIntro(false);
    sessionStorage.setItem("introWatched", "true");
  };

  if (showIntro) {
    return <VideoIntro onComplete={handleIntroComplete} />;
  }

  return (
    <>
      {!isMapPage && !isSoundwalkPage && <BackgroundAudio muted={bgMuted} />}
      <Routes>
        <Route path="/" element={<Navigate to={`/city/${cityOrder[0]}`} replace />} />
        <Route path="/city/:citySlug" element={<CityRoute lang={lang} onToggleLanguage={() => startTransition(() => setLang((current) => (current === "zh" ? "en" : "zh")))} bgMuted={bgMuted} setBgMuted={setBgMuted} />} />
        <Route path="/map" element={<MapRoute lang={lang} onToggleLanguage={() => startTransition(() => setLang((current) => (current === "zh" ? "en" : "zh")))} />} />
        <Route path="/soundwalk" element={<SoundwalkPage lang={lang} />} />
        <Route path="/about" element={<AboutPage lang={lang} onToggleLanguage={() => startTransition(() => setLang((current) => (current === "zh" ? "en" : "zh")))} bgMuted={bgMuted} setBgMuted={setBgMuted} />} />
        <Route path="*" element={<Navigate to={`/city/${cityOrder[0]}`} replace />} />
      </Routes>
    </>
  );
}

function CityRoute({ lang, onToggleLanguage, bgMuted, setBgMuted }) {
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

  return <CityPage city={city} lang={lang} onToggleLanguage={onToggleLanguage} bgMuted={bgMuted} setBgMuted={setBgMuted} />;
}

function MapRoute({ lang, onToggleLanguage }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return <MapPage lang={lang} onToggleLanguage={onToggleLanguage} navigate={navigate} />;
}

const STACK_RANGES = {
  "daming-palace": [1, 15],
  "bell-tower": [16, 22],
  "yongning-gate": [23, 26],
  "huanqiu-tiantan": [27, 30],
  "mingde-gate": [31, 33],
};

function CityPage({ city, lang, onToggleLanguage, bgMuted, setBgMuted }) {
  const navigate = useNavigate();
  const content = city.text[lang];
  const [headerVisible, setHeaderVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [stackProgress, setStackProgress] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollRef = useRef(0);
  const rafRef = useRef(0);
  const panelRef = useRef(null);
  const spectrumCanvasRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const sheetAudioRef = useRef(null);
  const objectUrlRef = useRef({ sheet: null });
  const sceneRefs = useRef([]);
  const layerRefs = useRef([]);
  const hotspotRefs = useRef([]);
  const damingStackRef = useRef(null);

  const hotspotLookup = useMemo(
    () => content.scenes.flatMap((scene) => scene.hotspots),
    [content.scenes]
  );

  const stackPlaces = useMemo(() => {
    const range = STACK_RANGES[city.slug];
    if (!range) return [];
    const [min, max] = range;
    return places
      .filter((place) => place.serial_number >= min && place.serial_number <= max)
      .sort((a, b) => a.serial_number - b.serial_number)
      .map((place) => ({
        serial: place.serial_number,
        title: lang === "zh" ? place.cn : place.en,
        subtitle: lang === "zh" ? place.en : place.cn,
        text: place.intro,
        img: resolveAssetUrl(place.img_address),
        audio: resolveAudioUrl(place.audio_address),
      }));
  }, [city.slug, lang]);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = lang === "zh" ? `${content.title} | 城市声景` : `${content.title} | City Soundscape`;
  }, [content.title, lang]);

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

        if (damingStackRef.current && stackPlaces.length > 1) {
          const rect = damingStackRef.current.getBoundingClientRect();
          const travel = rect.height - window.innerHeight;
          const normalized = travel > 0 ? clamp((-rect.top) / travel, 0, 1) : 0;
          setStackProgress(normalized * (stackPlaces.length - 1));
        } else {
          setStackProgress(0);
        }
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
  }, [city.slug, content.scenes, stackPlaces.length]);

  useEffect(() => {
    const container = damingStackRef.current;
    if (!container) return;
    const onPlay = (e) => {
      if (e.target.tagName !== "AUDIO") return;
      container.querySelectorAll("audio").forEach((a) => {
        if (a !== e.target) a.pause();
      });
    };
    container.addEventListener("play", onPlay, true);
    return () => container.removeEventListener("play", onPlay, true);
  }, [stackPlaces.length]);

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

  const getStackTranslate = (index) => {
    const offset = (index - stackProgress) * 100;
    return clamp(offset, 0, 110);
  };

  return (
    <div className="page-shell">
      <header className={`site-header ${headerVisible ? "" : "is-hidden"}`}>
        <div className="brand-lockup">
          <span className="brand-cn">{lang === "zh" ? "西安中轴线古建筑声景" : "XI'AN"}</span>
          <span className="brand-en">{lang === "zh" ? "CENTRAL AXIS ARCHITECTURAL SOUNDSCAPE" : "CENTRAL AXIS ARCHITECTURAL SOUNDSCAPE"}</span>
        </div>
        <nav className="city-nav" aria-label="City navigation">
          <button className="city-link" onClick={() => navigate("/map")} title={lang === "zh" ? "全景" : "Panorama"}>
            {lang === "zh" ? "全景" : "PANORAMA"}
          </button>
          <button className="city-link" onClick={() => navigate("/soundwalk")} title={lang === "zh" ? "声漫步" : "Soundwalk"}>
            {lang === "zh" ? "声漫步" : "SOUNDWALK"}
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
            aria-pressed={bgMuted}
            onClick={() => setBgMuted((current) => !current)}
          >
            {bgMuted ? (lang === "zh" ? "声音：关" : "Sound On") : lang === "zh" ? "声音：开" : "Sound Off"}
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

        {stackPlaces.length > 0 && (
          <section
            className="daming-stack"
            ref={damingStackRef}
            style={{ "--stack-card-count": stackPlaces.length }}
            aria-label={lang === "zh" ? "点位声景卡片" : "Place Cards"}
          >
            <div className="daming-stack__viewport">
            {stackPlaces.map((place, index) => (
                <article
                  className="daming-card"
                  key={place.serial}
                  style={{
                    "--card-index": index,
                    transform: `translate3d(0, ${getStackTranslate(index)}%, 0)`,
                  }}
                >
                  <div className="daming-card__layout">
                    <section className="daming-card__copy">
                      <header className="daming-card__header">
                        <span className="daming-card__index">{String(place.serial).padStart(2, "0")}</span>
                        <div>
                          <h2 className="daming-card__title">{place.title}</h2>
                          <p className="daming-card__subtitle">{place.subtitle}</p>
                        </div>
                      </header>

                      <p className="daming-card__text">{place.text}</p>

                      {place.audio ? (
                        <audio className="daming-card__audio" controls preload="none" src={place.audio} />
                      ) : (
                        <div className="daming-card__audio-placeholder">{lang === "zh" ? "暂无音频" : "Audio unavailable"}</div>
                      )}
                    </section>

                    <figure className="daming-card__visual">
                      {place.img ? (
                        <img className="daming-card__image" src={place.img} alt={place.title} loading="lazy" />
                      ) : (
                        <div className="daming-card__image daming-card__image--empty" aria-hidden="true" />
                      )}
                    </figure>

                    <div className="daming-card__ums">
                      <RmsChart serialNumber={place.serial} title="UMS / RMS" />
                    </div>

                    <div className="daming-card__lufs">
                      <LufsChart serialNumber={place.serial} title="LUFS" />
                    </div>
                  </div>
                </article>
            ))}
            </div>
          </section>
        )}

        <Footer lang={lang} note={content.footer} />
      </main>

      <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        {lang === "zh" ? "顶部" : "TOP"}
      </button>

      {!STACK_RANGES[city.slug] && (
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
      )}
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

function BackgroundAudio({ muted }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = '/background.wav'; // 相对于public的路径
    audio.loop = true;
    audio.volume = 0.4;
    audio.muted = muted;

    if (!muted) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }

    return () => {
      audio.pause();
    };
  }, [muted]);

  return <audio ref={audioRef} />;
}

function resolveRmsSource(serialNumber) {
  const serial = Number(serialNumber);
  if (!Number.isFinite(serial)) return null;
  if (serial >= 1 && serial <= 15) return { src: rms151Url, chartId: `chart_${serial - 1}`, scope: "1-15" };
  if (serial >= 16 && serial <= 33) return { src: rms1633Url, chartId: `chart_${serial - 16}`, scope: "16-33" };
  return null;
}

export function RmsChart({ serialNumber, title = "RMS" }) {
  const iframeRef = useRef(null);
  const resolved = useMemo(() => resolveRmsSource(serialNumber), [serialNumber]);

  const postSelect = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !resolved) return;
    win.postMessage({ type: "SET_RMS_CHART", chartId: resolved.chartId }, "*");
    win.postMessage({ type: "SET_SCALE", scale: 0.7 }, "*");
  };

  useEffect(() => {
    postSelect();
  }, [resolved?.chartId, resolved?.src]);

  if (!resolved) return null;

  return (
    <section className="metric-card" aria-label={`${title} chart`}>
      <div className="metric-card__title">
        {title} · {resolved.scope} · {resolved.chartId}
      </div>
      <iframe
        ref={iframeRef}
        src={resolved.src}
        title={`RMS ${resolved.scope} ${resolved.chartId}`}
        loading="lazy"
        onLoad={postSelect}
        className="metric-card__frame"
      />
    </section>
  );
}

function resolveLufsSource(serialNumber) {
  const serial = Number(serialNumber);
  if (!Number.isFinite(serial)) return null;
  if (serial >= 1 && serial <= 15) return { src: lufs151Url, chartId: `chart_${serial - 1}`, scope: "1-15" };
  if (serial >= 16 && serial <= 33) return { src: lufs1633Url, chartId: `chart_${serial - 16}`, scope: "16-33" };
  return null;
}

export function LufsChart({ serialNumber, title = "LUFS" }) {
  const iframeRef = useRef(null);
  const resolved = useMemo(() => resolveLufsSource(serialNumber), [serialNumber]);

  const postSelect = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !resolved) return;
    win.postMessage({ type: "SET_LUFS_CHART", chartId: resolved.chartId }, "*");
    win.postMessage({ type: "SET_SCALE", scale: 0.7 }, "*");
  };

  useEffect(() => {
    postSelect();
  }, [resolved?.chartId, resolved?.src]);

  if (!resolved) return null;

  return (
    <section className="metric-card" aria-label={`${title} chart`}>
      <div className="metric-card__title">
        {title} · {resolved.scope} · {resolved.chartId}
      </div>
      <iframe
        ref={iframeRef}
        src={resolved.src}
        title={`LUFS ${resolved.scope} ${resolved.chartId}`}
        loading="lazy"
        onLoad={postSelect}
        className="metric-card__frame"
      />
    </section>
  );
}
