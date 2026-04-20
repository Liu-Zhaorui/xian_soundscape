import { useEffect, useRef, useState } from "react";
import { locations, mapCenter, mapZoom } from "./content/cities/locations";
import places from "./content/places.json";
import { Footer } from "./Footer";

const imageAssets = import.meta.glob("./content/img/typical/*.{jpg,JPG,png,jpeg}", { as: "url", eager: true });
const audioAssets = import.meta.glob("./content/audio/*.wav", { as: "url", eager: true });

const normalizeAssetName = (path) => path.split(/[/\\\\]/).pop().toLowerCase();
const imageUrls = Object.fromEntries(
  Object.entries(imageAssets).map(([path, url]) => [normalizeAssetName(path), url])
);
const audioUrls = Object.fromEntries(
  Object.entries(audioAssets).map(([path, url]) => [normalizeAssetName(path), url])
);

const resolveAssetUrl = (map, name) => {
  if (!name) return null;
  const key = name.toLowerCase();
  if (map[key]) return map[key];
  const base = key.replace(/\.[^.]+$/, "");
  return map[`${base}.jpg`] || map[`${base}.jpeg`] || map[`${base}.png`] || map[`${base}.wav`] || null;
};

export function MapPage({ lang, onToggleLanguage, navigate }) {
  const [headerVisible, setHeaderVisible] = useState(true);

  const scrollRef = useRef(0);
  const rafRef = useRef(0);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const title = lang === "zh" ? "西安声景全景" : "Xian Soundscape Panorama";
  const subtitle = lang === "zh" ? "在地图上探索三个标志性地点的声音故事" : "Explore the acoustic stories of three iconic locations";

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
      const map = L.map(mapRef.current, {
        center: mapCenter,
        zoom: mapZoom,
        minZoom: 12,        // 最小缩放级别
        maxZoom: 16,        // 最大缩放级别
        maxBounds: [         // 地图边界限制（西安地区）
          [34.15, 108.7],   // 西南角
          [34.45, 109.1]    // 东北角
        ],
        maxBoundsViscosity: 1.0  // 边界粘性，1.0表示完全限制在边界内
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add markers from Excel data
      places.forEach((place) => {
        const marker = L.circleMarker([place.latitude, place.longitude], {
          radius: 15,
          fillColor: "#ff4444",
          color: "#ff4444",
          weight: 2,
          opacity: 0.9,
          fillOpacity: 0.5,
          className: "map-marker-point"
        });

        const title = lang === "zh" ? place.cn : place.en;
        const description = place.intro ? place.intro.replace(/\n/g, "<br />") : "";
        const imageUrl = resolveAssetUrl(imageUrls, place.img_address);
        const audioUrl = resolveAssetUrl(audioUrls, place.audio_address);
        const popupContent = `
          <div class="map-popup">
            <div class="popup-title">${title}</div>
            ${description ? `<div class="popup-description">${description}</div>` : ""}
            ${imageUrl ? `<img src="${imageUrl}" alt="${title}" class="map-popup-image"/>` : ""}
            ${audioUrl ? `<audio controls src="${audioUrl}" class="map-popup-audio"></audio>` : ""}
          </div>`;

        marker.bindPopup(popupContent, { maxWidth: 380 });
        const tooltipContent = `${title}<br />${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)}`;
        marker.bindTooltip(tooltipContent, { 
          permanent: false, 
          direction: "top",
          offset: [0, -15]
        });
        marker.addTo(map);

        marker.on("mouseover", () => {
          marker.setStyle({
            fillOpacity: 0.7,
            weight: 3,
            radius: 14
          });
        });

        marker.on("mouseout", () => {
          marker.setStyle({
            fillOpacity: 0.6,
            weight: 2,
            radius: 15
          });
        });

        marker.on("click", () => {
          map.flyTo([place.latitude + 0.006, place.longitude], 16, {
            duration: 1.5
          });
        });

        markersRef.current.push(marker);
      });
    }
  }, [lang]);
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
          <span className="brand-cn">{lang === "zh" ? "西安中轴线古建筑声景" : "XI'AN"}</span>
          <span className="brand-en">{lang === "zh" ? "CENTRAL AXIS ARCHITECTURAL SOUNDSCAPE" : "CENTRAL AXIS ARCHITECTURAL SOUNDSCAPE"}</span>
        </div>
        <nav className="city-nav" aria-label="City navigation">
          <button className="city-link is-active" title={lang === "zh" ? "全景" : "Panorama"}>
            {lang === "zh" ? "全景" : "PANORAMA"}
          </button>
          <button className="city-link" onClick={() => navigate("/soundwalk")}> 
            {lang === "zh" ? "声漫步" : "SOUNDWALK"}
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
          <button className="lang-toggle" onClick={onToggleLanguage}>
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>

      <main>
        <div id="map" ref={mapRef} className="map-container" />
      </main>

    </div>
  );
}

