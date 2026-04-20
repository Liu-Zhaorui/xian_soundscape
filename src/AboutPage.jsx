import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Footer } from "./Footer";

export function AboutPage({ lang, onToggleLanguage, bgMuted, setBgMuted }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = lang === "zh" ? "关于 | 城市声景" : "About | City Soundscape";
    window.scrollTo(0, 0);
  }, [lang]);

  return (
    <div className="page-shell">
      <main>
        <section className="hero about-hero">
          <div className="about-top-actions">
            <button className="about-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
              {lang === "zh" ? "返回" : "Back"}
            </button>
            <button
              className="audio-toggle"
              aria-pressed={bgMuted}
              onClick={() => setBgMuted((current) => !current)}
            >
              {bgMuted ? (lang === "zh" ? "声音：开" : "Sound On") : lang === "zh" ? "声音：关" : "Sound Off"}
            </button>
            <button className="lang-toggle" onClick={onToggleLanguage}>
              {lang === "zh" ? "EN" : "中文"}
            </button>
          </div>
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="eyebrow">{lang === "zh" ? "关于项目" : "About the Project"}</span>
              <h1 className="hero-title">{lang === "zh" ? "城市声景" : "City Soundscape"}</h1>
              <p className="hero-subtitle">
                {lang === "zh"
                  ? "构建一个基于西安地标声景的沉浸式在线体验，呈现创作与录音过程。"
                  : "An immersive web experience exploring the concept and recording process behind Xian's soundscape."}
              </p>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h2>{lang === "zh" ? "构思" : "Concept"}</h2>
          <p>
            {lang === "zh"
              ? "这个项目旨在通过声音重构西安的地理与文化记忆。我们从城市标志性地点的声景出发，尝试让用户在浏览页面时获得身临其境的听觉体验。"
              : "This project aims to reconstruct Xian's geography and cultural memory through sound. Starting from the acoustic landscapes of iconic locations, we seek to give visitors an immersive listening experience as they explore the site."}
          </p>
        </section>

        <section className="about-section">
          <h2>{lang === "zh" ? "录音过程" : "Recording Process"}</h2>
          <p>
            {lang === "zh"
              ? "录音采用现场采样与合成声音相结合的方式。我们将每个地点的环境声音、建筑声响与气候元素融入音轨，保留城市的空间感与时间感。"
              : "The recording process combines field sampling with sound design. We blended environmental noises, architectural resonances, and weather elements to preserve each location's sense of space and time."}
          </p>
        </section>

        <section className="about-section">
          <h2>{lang === "zh" ? "体验目标" : "Experience Goal"}</h2>
          <p>
            {lang === "zh"
              ? "项目希望让观众在视觉与听觉之间建立连接，以声音为线索重新认识西安这座城市。屏幕之外的声音被重新组织，呈现新的想象路径。"
              : "The goal is to connect visuals and audio, allowing visitors to rediscover Xian through sound. Sounds from beyond the screen are reorganized to present a fresh imaginative path."}
          </p>
        </section>
      </main>

        <Footer
        lang={lang}
        />

      <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        {lang === "zh" ? "顶部" : "TOP"}
      </button>
    </div>
  );
}
