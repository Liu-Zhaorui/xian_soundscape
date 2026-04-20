import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import places from "./content/places.json";

const imageAssets = import.meta.glob("./content/img/typical/*.{jpg,JPG,png,jpeg}", { as: "url", eager: true });
const audioAssets = import.meta.glob("./content/audio/*.wav", { as: "url", eager: true });

const normalizeAssetName = (path) => path.split(/[/\\]/).pop().toLowerCase();
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

const particleCount = 28000;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getImageData(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 128;
      canvas.height = 128;
      ctx.drawImage(img, 0, 0, 128, 128);
      resolve(ctx.getImageData(0, 0, 128, 128));
    };
    img.onerror = () => {
      resolve(new ImageData(128, 128));
    };
  });
}

function fillBuffer(posArr, colArr, speedArr, data) {
  const pixels = data.data;
  for (let i = 0; i < particleCount; i++) {
    const idx = Math.floor(Math.random() * (pixels.length / 4));
    const r = pixels[idx * 4] / 255;
    const g = pixels[idx * 4 + 1] / 255;
    const b = pixels[idx * 4 + 2] / 255;

    const brightness = (r + g + b) / 3;
    const speed = 1.0 / (brightness + 0.1);

    const x = (idx % 128) / 128 * 8 - 4;
    const y = -(Math.floor(idx / 128)) / 128 * 6 + 3;
    const z = (Math.random() - 0.5) * 0.6;

    posArr[i * 3] = x;
    posArr[i * 3 + 1] = y;
    posArr[i * 3 + 2] = z;

    colArr[i * 3] = r;
    colArr[i * 3 + 1] = g;
    colArr[i * 3 + 2] = b;

    speedArr[i] = speed;
  }
}

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uAudioLevel;
  attribute vec3 nextPosition;
  attribute vec3 nextColor;
  attribute float speed;
  attribute float nextSpeed;
  attribute float random;
  varying vec3 vColor;

  void main() {
    vec3 mixedPosition = mix(position, nextPosition, uProgress);
    vColor = mix(color, nextColor, uProgress);
    float mixedSpeed = mix(speed, nextSpeed, uProgress);
    mixedPosition.x += sin(uTime * 0.5 + random * 10.0) * 0.05 * mixedSpeed * (1.0 + uAudioLevel);
    mixedPosition.y += cos(uTime * 0.5 + random * 10.0) * 0.05 * mixedSpeed * (1.0 + uAudioLevel);

    vec4 mvPosition = modelViewMatrix * vec4(mixedPosition, 1.0);
    gl_PointSize = 2.0 * (10.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, 0.85);
  }
`;

export function SoundwalkPage({ lang }) {
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(false);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneStateRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const currentGainRef = useRef(null);
  const currentAudioRef = useRef(null);
  const bufferMapRef = useRef(new Map());
  const currentIndexRef = useRef(0);
  const animationRef = useRef(null);
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
  
    if (currentGainRef.current && audioContextRef.current) {
      const now = audioContextRef.current.currentTime;
      // 采用 0.5 秒平滑切换，避免爆音
      // 使用 0.001 而不是 0 是因为指数增长不能从 0 开始
      const targetVolume = newMuted ? 0.001 : 1.0;
      currentGainRef.current.gain.exponentialRampToValueAtTime(targetVolume, now + 0.5);
    }
  };
  const isTransitioningRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState(lang === "zh" ? "声漫步：准备就绪" : "Soundwalk: Ready");

  const assetList = useMemo(
    () =>
      places.map((place) => ({
        serial_number: place.serial_number,
        title: lang === "zh" ? place.cn : place.en,
        text: place.intro,
        img: resolveAssetUrl(imageUrls, place.img_address),
        audio: resolveAssetUrl(audioUrls, place.audio_address),
      })),
    [lang]
  );

  useEffect(() => {
    document.title = lang === "zh" ? "声漫步 | 城市声景" : "Soundwalk | City Soundscape";
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    let THREE = null;
    const randoms = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i += 1) {
      randoms[i] = Math.random();
    }

    const resizeRenderer = () => {
    const renderer = rendererRef.current;
    const state = sceneStateRef.current;
    if (!renderer || !state || !canvasRef.current) return;
    const width = canvasRef.current.clientWidth;
    const height = canvasRef.current.clientHeight;
    renderer.setSize(width, height);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
};

    const initScene = async () => {
      THREE = await import("three");
      if (cancelled || !canvasRef.current) return;

      const promises = assetList.map(async (asset) => {
        if (!asset.img) return;
        const data = await getImageData(asset.img);
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const speeds = new Float32Array(particleCount);
        fillBuffer(positions, colors, speeds, data);
        bufferMapRef.current.set(asset.img, { positions, colors, speeds });
      });

      await Promise.all(promises);
      if (cancelled) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(65, canvasRef.current.clientWidth / canvasRef.current.clientHeight, 0.1, 1000);
      camera.position.z = 5.4;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      // 使用新的 ref 容器大小
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      renderer.setSize(width, height);

      canvasRef.current.appendChild(renderer.domElement); 
      rendererRef.current = renderer;

      const initialBuffers = bufferMapRef.current.get(assetList[0]?.img) || {
        positions: new Float32Array(particleCount * 3),
        colors: new Float32Array(particleCount * 3),
        speeds: new Float32Array(particleCount),
      };
      const nextBuffers = bufferMapRef.current.get(assetList[1]?.img) || initialBuffers;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(initialBuffers.positions.slice(), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(initialBuffers.colors.slice(), 3));
      geometry.setAttribute("nextPosition", new THREE.BufferAttribute(nextBuffers.positions.slice(), 3));
      geometry.setAttribute("nextColor", new THREE.BufferAttribute(nextBuffers.colors.slice(), 3));
      geometry.setAttribute("speed", new THREE.BufferAttribute(initialBuffers.speeds.slice(), 1));
      geometry.setAttribute("nextSpeed", new THREE.BufferAttribute(nextBuffers.speeds.slice(), 1));
      geometry.setAttribute("random", new THREE.BufferAttribute(randoms, 1));

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uAudioLevel: { value: 0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      sceneStateRef.current = { scene, camera, points, geometry, material };

      const animate = () => {
        animationRef.current = requestAnimationFrame(animate);
        if (!sceneStateRef.current) return;
        const state = sceneStateRef.current;
        state.material.uniforms.uTime.value += 0.01;

        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((acc, value) => acc + value, 0) / dataArray.length / 255;
          state.material.uniforms.uAudioLevel.value = average;
        }

        renderer.render(scene, camera);
      };

      animate();
      window.addEventListener("resize", resizeRenderer);
    };

    initScene();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resizeRenderer);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      }
    };
  }, [assetList]);

  useEffect(() => {
    const handleKeydown = (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        if (assetList.length < 2) return;
        let nextIndex = currentIndex;
        while (nextIndex === currentIndex) {
          nextIndex = Math.floor(Math.random() * assetList.length);
        }
        transitionToIndex(nextIndex);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [currentIndex, assetList.length]);

  const currentAsset = assetList[currentIndex] || assetList[0] || {};

  const transitionToIndex = (nextIndex) => {
    if (isTransitioningRef.current || !sceneStateRef.current) return;
    if (nextIndex === currentIndex) return;

    const nextAsset = assetList[nextIndex];
    const state = sceneStateRef.current;
    const nextBuffers = bufferMapRef.current.get(nextAsset.img);
    if (!nextBuffers) return;

    isTransitioningRef.current = true;
    setStatus(lang === "zh" ? `正在切换：${nextAsset.title}` : `Walking to scene: ${nextAsset.title}`);

    state.geometry.attributes.nextPosition.array.set(nextBuffers.positions);
    state.geometry.attributes.nextColor.array.set(nextBuffers.colors);
    state.geometry.attributes.nextSpeed.array.set(nextBuffers.speeds);
    state.geometry.attributes.nextPosition.needsUpdate = true;
    state.geometry.attributes.nextColor.needsUpdate = true;
    state.geometry.attributes.nextSpeed.needsUpdate = true;

    const startTime = performance.now();
    const duration = 1500;

    const animateTransition = () => {
      const elapsed = performance.now() - startTime;
      const progress = clamp(elapsed / duration, 0, 1);
      state.material.uniforms.uProgress.value = easeInOutCubic(progress);

      if (progress < 1) {
        requestAnimationFrame(animateTransition);
      } else {
        state.geometry.attributes.position.array.set(nextBuffers.positions);
        state.geometry.attributes.color.array.set(nextBuffers.colors);
        state.geometry.attributes.speed.array.set(nextBuffers.speeds);
        state.geometry.attributes.position.needsUpdate = true;
        state.geometry.attributes.color.needsUpdate = true;
        state.geometry.attributes.speed.needsUpdate = true;
        state.material.uniforms.uProgress.value = 0;
        isTransitioningRef.current = false;
        setCurrentIndex(nextIndex);
        currentIndexRef.current = nextIndex;
        setStatus(lang === "zh" ? `声漫步：${nextAsset.title}` : `Soundwalk: ${nextAsset.title}`);
      }
    };

    playSceneAudio(nextAsset.audio);
    animateTransition();
  };

  const playSceneAudio = (url) => {
    if (!url) return;
    const now = audioContextRef.current ? audioContextRef.current.currentTime : 0;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => undefined);
    }

    if (currentGainRef.current) {
      const oldGain = currentGainRef.current;
      oldGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      setTimeout(() => {
        if (oldGain.disconnect) oldGain.disconnect();
      }, 2200);
    }

    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.loop = true;
    const source = audioContext.createMediaElementSource(audio);
    const newGain = audioContext.createGain();
    newGain.gain.setValueAtTime(0.001, now);
    newGain.gain.exponentialRampToValueAtTime(isMuted ? 0.001 : 1.0, now + 2.0);
    source.connect(newGain);

    if (!analyserRef.current) {
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.86;
      newGain.connect(analyserRef.current);
      analyserRef.current.connect(audioContext.destination);
    } else {
      newGain.connect(analyserRef.current);
    }

    audio.play().catch(() => undefined);
    currentAudioRef.current = audio;
    currentGainRef.current = newGain;
  };

  return (
  <div className="page-shell soundwalk-shell">
    <main className="soundwalk-fullscreen">
      <section className="soundwalk-canvas" aria-label={lang === "zh" ? "声漫步画布" : "Soundwalk canvas"}>
        
        {/* Three.js 背景 */}
        <div ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

        {/* 左上角返回按钮 */}
        <button className="soundwalk-back" onClick={() => navigate(-1)} style={{ zIndex: 11 }}>
          {lang === "zh" ? "返回" : "Back"}
        </button>

        {/* 右上角声音开关 - 新增 */}
        <button 
          className="soundwalk-mute-btn" 
          onClick={toggleMute}
        >
          {isMuted ? (lang === "zh" ? "声音：关" : "SOUND: OFF") : (lang === "zh" ? "声音：开" : "SOUND: ON")}
        </button>

        {/* 底部 UI 覆盖层 */}
        <div className="soundwalk-overlay" style={{ zIndex: 10, pointerEvents: 'none' }}>
          <div className="soundwalk-number">{lang === "zh" ? "序号" : "No."} {currentAsset.serial_number || 0}</div>
          <h1 className="soundwalk-title">{currentAsset.title}</h1>
          <div className="soundwalk-instructions">
            {lang === "zh" ? "按方向键切换场景 [↑ ↓ ← →]" : "Press Arrow Keys to Explore [↑ ↓ ← →]"}
          </div>
        </div>
        
      </section>
    </main>
    </div>
  );
}
