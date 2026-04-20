import { useState, useEffect, useRef } from "react";
import introVideoSrc from "./content/intro.mp4";
import "./VideoIntro.css";

export function VideoIntro({ onComplete }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnded, setIsVideoEnded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 默认静音
    video.muted = true;
    setIsMuted(true);

    // 自动播放
    video.play().catch(() => {
      console.log("自动播放被浏览器阻止");
    });

    const handleEnded = () => {
      setIsPlaying(false);
      setIsVideoEnded(true);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    // 进入全屏
    if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {
        console.log("全屏请求被拒绝");
      });
    }

    return () => {
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  const handleSkip = () => {
    onComplete();
  };

  const handleStart = () => {
    onComplete();
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !videoRef.current.muted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  return (
    <div className="video-intro-container">
      <video
        ref={videoRef}
        className="intro-video"
        playsInline
      >
        <source src={introVideoSrc} type="video/mp4" />
        您的浏览器不支持视频播放
      </video>

      {/* 右上角控制按钮 */}
      <div className="video-controls">
        <button
          className="control-btn mute-btn"
          onClick={toggleMute}
          title={isMuted ? "取消静音" : "静音"}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          )}
        </button>

        <button
          className="control-btn skip-btn"
          onClick={handleSkip}
          title="跳过视频"
        >
          跳过
        </button>
      </div>

      {/* 视频完成后显示的"开始"按钮 */}
      {isVideoEnded && (
        <div className="video-overlay">
          <button className="start-btn" onClick={handleStart}>
            开始
          </button>
        </div>
      )}
    </div>
  );
}
