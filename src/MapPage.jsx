import { useEffect, useRef, useState } from "react";
import { locations, mapCenter, mapZoom } from "./content/cities/locations";
import { createWaveBlob } from "./lib/audio";

export function MapPage({ lang, onToggleLanguage, navigate }) {
  const [headerVisible, setHeaderVisible] = useState(true);
  const [muted, setMuted] = useState(false);
  const [activeMarker, setActiveMarker] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [currentMapZoom, setCurrentMapZoom] = useState(mapZoom);
  
  const scrollRef = useRef(0);
  const rafRef = useRef(0);
  const panelRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const audioContextRef = useRef(null);
  const audioSourcesRef = useRef({});
  const pannerNodesRef = useRef({});
  const gainNodesRef = useRef({});
  const objectUrlRef = useRef({});
  const audioElementsRef = useRef({});

  const title = lang === "zh" ? "西安声景全景" : "Xian Soundscape Panorama";
  const subtitle = lang === "zh" ? "在地图上探索三个标志性地点的声音故事" : "Explore the acoustic stories of three iconic locations";

  // Initialize audio context
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = context;
        if (context.state === "suspended") {
          context.resume().catch(() => {});
        }
      } catch (e) {
        console.error("Failed to initialize AudioContext:", e);
        return null;
      }
    }
    return audioContextRef.current;
  };

  // Initialize audio sources for all markers
  useEffect(() => {
    const audioContext = getAudioContext();
    if (!audioContext || muted) return;

    Object.entries(locations).forEach(([citySlug, location]) => {
      location.hotspots.forEach((hotspot) => {
        const audioKey = `${citySlug}-${hotspot.id}`;
        
        if (!audioElementsRef.current[audioKey]) {
          // Create audio element
          const audio = new Audio();
          audio.loop = true;
          audio.volume = 0;
          
          // Create blob for audio
          const soundConfig = {
            seed: Math.random(),
            color: hotspot.id === "bell" ? "bell" : hotspot.id === "corridor" ? "wind" : "water"
          };
          
          const blob = createWaveBlob(soundConfig, { duration: 24, gain: 0.2 });
          const url = URL.createObjectURL(blob);
          audio.src = url;
          
          objectUrlRef.current[audioKey] = url;
          audioElementsRef.current[audioKey] = audio;

          // Create Web Audio API nodes for spatial audio
          if (!audioSourcesRef.current[audioKey]) {
            try {
              const source = audioContext.createMediaElementAudioSource(audio);
              const gainNode = audioContext.createGain();
              const pannerNode = audioContext.createPanner();
              
              // Configure panner for spatial audio
              pannerNode.panningModel = "HRTF";
              pannerNode.distanceModel = "inverse";
              pannerNode.refDistance = 1;
              pannerNode.maxDistance = 100;
              pannerNode.rolloffFactor = 1;

              source.connect(gainNode);
              gainNode.connect(pannerNode);
              pannerNode.connect(audioContext.destination);

              audioSourcesRef.current[audioKey] = source;
              gainNodesRef.current[audioKey] = gainNode;
              pannerNodesRef.current[audioKey] = pannerNode;

              // Start playing
              audio.play().catch(() => {});
            } catch (e) {
              console.error(`Failed to initialize audio for ${audioKey}:`, e);
            }
          }
        }
      });
    });

    return () => {
      // Cleanup
      Object.values(objectUrlRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [muted]);

  // Load and initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current) return;

    // Check if Leaflet is already loaded
    if (typeof window.L === "undefined") {
      // Load Leaflet CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      // Load Leaflet JS
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        initializeMap();
      };
      document.body.appendChild(script);
    } else {
      initializeMap();
    }

    function initializeMap() {
      if (!mapRef.current) return;
      if (mapRef.current.classList.contains("leaflet-container")) return;

      const L = window.L;
      const map = L.map(mapRef.current).setView(mapCenter, mapZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add markers for all locations
      Object.entries(locations).forEach(([citySlug, location]) => {
        const marker = L.circleMarker(location.coordinates, {
          radius: 12,
          fillColor: "#88e0ff",
          color: "#88e0ff",
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.4,
          className: "map-marker-point"
        })
          .bindPopup(`<div style="font-family: inherit;"><strong>${location.name[lang]}</strong><br />${location.description[lang]}</div>`)
          .addTo(map);

        // Add interactive behavior
        marker.on("click", () => {
          setActiveMarker({ slug: citySlug, data: location });
          setSheetOpen(true);
        });

        marker.on("mouseover", () => {
          marker.setStyle({
            fillOpacity: 0.7,
            weight: 3,
            radius: 14
          });
        });

        marker.on("mouseout", () => {
          marker.setStyle({
            fillOpacity: 0.4,
            weight: 2,
            radius: 12
          });
        });

        markersRef.current.push(marker);
      });

      // Handle map events for audio updates
      const updateAudioState = () => {
        setCurrentMapZoom(map.getZoom());
        updateAudioVolumes(map);
      };

      map.on("zoom", updateAudioState);
      map.on("move", updateAudioState);
      
      // Initial update
      updateAudioState();
    }
  }, [lang]);

  const updateAudioVolumes = (map) => {
    const audioContext = audioContextRef.current;
    if (!map || !audioContext) return;
    
    const bounds = map.getBounds();
    const mapSize = map.getSize();
    const centerPixel = map.project(map.getCenter());
    const currentZoom = map.getZoom();

    Object.entries(locations).forEach(([citySlug, location]) => {
      location.hotspots.forEach((hotspot) => {
        const L = window.L;
        const point = L.latLng(hotspot.coordinates);
        const pointPixel = map.project(point);
        const dx = pointPixel.x - centerPixel.x;
        const dy = pointPixel.y - centerPixel.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const audioKey = `${citySlug}-${hotspot.id}`;
        const gainNode = gainNodesRef.current[audioKey];
        const pannerNode = pannerNodesRef.current[audioKey];

        if (!gainNode || !pannerNode) return;

        // Calculate viewport half dimensions
        const viewportHalfWidth = mapSize.x / 2;
        const viewportHalfHeight = mapSize.y / 2;
        const maxDistance = Math.sqrt(
          viewportHalfWidth * viewportHalfWidth + 
          viewportHalfHeight * viewportHalfHeight
        );
        
        // Check if point is in viewport bounds
        const isInViewport = bounds.contains(point);
        
        let finalVolume = 0;
        
        if (isInViewport) {
          // 1. Calculate zoom-based volume (closer zoom = louder)
          const zoomDiff = currentZoom - mapZoom;
          const zoomVolume = Math.max(0.15, Math.min(1, 0.5 + zoomDiff * 0.15));
          
          // 2. Calculate distance-based volume (closer to center = louder)
          const proximityVolume = Math.max(0, 1 - (distance / maxDistance) * 1.2);
          
          // Combined volume
          finalVolume = zoomVolume * proximityVolume;
          finalVolume = Math.min(0.85, Math.max(0, finalVolume));
        }
        
        // Set gain with smooth transition
        gainNode.gain.setTargetAtTime(
          muted ? 0 : finalVolume, 
          audioContext.currentTime, 
          0.1
        );
        
        // Set stereo panning based on horizontal position
        if (isInViewport && finalVolume > 0.01) {
          // Normalize pan value: -1 (left), 0 (center), 1 (right)
          const panValue = (dx / viewportHalfWidth);
          const clampedPan = Math.max(-1, Math.min(1, panValue));
          
          // Set 3D position for spatial audio using panner
          const positionScale = 30;
          const zPosition = 20;
          pannerNode.setPosition(
            clampedPan * positionScale,
            0,
            zPosition
          );
        }
      });
    });
  };

  // Header scroll handling
  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const current = window.scrollY;
        if (current > scrollRef.current + 8 && current > 120) setHeaderVisible(false);
        if (current < scrollRef.current - 8 || current < 48) setHeaderVisible(true);
        scrollRef.current = current;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="page-shell">
      <header className={`site-header ${headerVisible ? "" : "is-hidden"}`}>
        <div className="brand-lockup">
          <span className="brand-cn">{lang === "zh" ? "城市声景" : "CITY"}</span>
          <span className="brand-en">{lang === "zh" ? "City Soundscape" : "Urban Acoustic Narrative"}</span>
        </div>
        <nav className="city-nav" aria-label="City navigation">
          <button className="city-link is-active" title={lang === "zh" ? "全景" : "Panorama"}>
            {lang === "zh" ? "全景" : "PANORAMA"}
          </button>
          {Object.entries(locations).map(([slug, location]) => (
            <button
              key={slug}
              className="city-link"
              onClick={() => navigate(`/city/${slug}`)}
            >
              {location.name[lang]}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="audio-toggle"
            aria-pressed={muted}
            onClick={() => setMuted((current) => !current)}
          >
            {muted ? (lang === "zh" ? "开启声音" : "Sound On") : lang === "zh" ? "静音" : "Mute"}
          </button>
          <button className="lang-toggle" onClick={onToggleLanguage}>
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>

      <main>
        <section className="hero map-hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <h1 className="hero-title">{title}</h1>
              <p className="hero-subtitle">{subtitle}</p>
            </div>
          </div>
        </section>

        <div id="map" ref={mapRef} className="map-container" />

        <section className={`info-sheet ${sheetOpen ? "is-open" : ""}`} aria-hidden={!sheetOpen}>
          <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} />
          <div className="sheet-panel" ref={panelRef} role="dialog" aria-modal="true">
            <button className="sheet-close" onClick={() => setSheetOpen(false)} aria-label="Close">×</button>
            {activeMarker && (
              <div className="sheet-content">
                <div className="sheet-copy">
                  <h2>{activeMarker.data.name[lang]}</h2>
                  <p className="sheet-text">{activeMarker.data.description[lang]}</p>
                  <p className="sheet-text" style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                    {lang === "zh" ? "坐标: " : "Coordinates: "}
                    {activeMarker.data.coordinates[0].toFixed(4)}, {activeMarker.data.coordinates[1].toFixed(4)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        {lang === "zh" ? "顶部" : "TOP"}
      </button>
    </div>
  );
}

