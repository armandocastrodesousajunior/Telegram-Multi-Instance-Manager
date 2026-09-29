"use client";

import React, { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Lock } from "lucide-react";

export default function CallPlayerPage() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [callerName, setCallerName] = useState<string>("Chamada de Vídeo");
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(true);
  const [callEnded, setCallEnded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Inicializa Telegram WebApp
    if (typeof window !== "undefined") {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        // Ativa cores do tema
        if (tg.setHeaderColor) tg.setHeaderColor("#0a0a0f");
        if (tg.setBackgroundColor) tg.setBackgroundColor("#0a0a0f");
      }

      // 2. Extrai parâmetros via searchParams ou start_param
      const urlParams = new URLSearchParams(window.location.search);
      let vUrl = urlParams.get("video") || "";
      let cName = urlParams.get("name") || "";

      // Se veio via startapp (start_param)
      const startParam = tg?.initDataUnsafe?.start_param || urlParams.get("startapp") || urlParams.get("tgWebAppStartParam");
      if (startParam) {
        try {
          // Decodifica base64url ou JSON
          const decoded = atob(startParam.replace(/-/g, "+").replace(/_/g, "/"));
          const parsed = JSON.parse(decoded);
          if (parsed.video) vUrl = parsed.video;
          if (parsed.name) cName = parsed.name;
        } catch (e) {
          // fallback se for apenas a URL direta
          if (startParam.startsWith("http")) vUrl = decodeURIComponent(startParam);
        }
      }

      if (vUrl) setVideoUrl(vUrl);
      if (cName) setCallerName(cName);
    }
  }, []);

  // Timer da chamada
  useEffect(() => {
    if (isPlaying && !callEnded) {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, callEnded]);

  const handleVideoPlay = () => {
    setIsPlaying(true);
  };

  const handleVideoEnded = () => {
    handleEndCall();
  };

  const handleEndCall = () => {
    setCallEnded(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (videoRef.current) videoRef.current.pause();

    setTimeout(() => {
      if (typeof window !== "undefined") {
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.close) {
          tg.close();
        } else {
          window.close();
        }
      }
    }, 800);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

      <main
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "#0a0a0f",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          userSelect: "none",
          WebkitUserSelect: "none"
        }}
        onClick={() => setShowControls((prev) => !prev)}
      >
        {/* Vídeo Fullscreen */}
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            playsInline
            muted={isMuted}
            onPlay={handleVideoPlay}
            onEnded={handleVideoEnded}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 1
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
              background: "linear-gradient(180deg, #182533 0%, #0d141e 100%)"
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: "bold",
                marginBottom: 16
              }}
            >
              {callerName.charAt(0).toUpperCase()}
            </div>
            <p style={{ opacity: 0.7, fontSize: 14 }}>Aguardando vídeo da chamada...</p>
          </div>
        )}

        {/* Gradiente sutil superior e inferior para legibilidade */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "120px",
            background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
            zIndex: 2,
            pointerEvents: "none",
            transition: "opacity 0.3s ease",
            opacity: showControls ? 1 : 0
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "160px",
            background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
            zIndex: 2,
            pointerEvents: "none",
            transition: "opacity 0.3s ease",
            opacity: showControls ? 1 : 0
          }}
        />

        {/* Barra Superior (Nome, Duração, Emojis de Criptografia E2EE) */}
        <header
          style={{
            position: "relative",
            zIndex: 3,
            width: "100%",
            padding: "24px 20px 0 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            transition: "opacity 0.3s ease",
            opacity: showControls ? 1 : 0
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: "600", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {callerName}
            </h1>
            <span style={{ fontSize: "14px", color: callEnded ? "#ef4444" : "#4ade80", marginTop: "2px", fontWeight: "500", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {callEnded ? "Chamada finalizada" : formatDuration(duration)}
            </span>
          </div>

          {/* 4 Emojis de Criptografia do Telegram */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
              padding: "4px 8px",
              borderRadius: "16px",
              fontSize: "13px"
            }}
          >
            <Lock size={12} color="#4ade80" />
            <span>🍓 🍇 🍋 🍍</span>
          </div>
        </header>

        {/* Picture-in-Picture (Simulação da Câmera Frontal do Lead) */}
        <div
          style={{
            position: "absolute",
            top: "90px",
            right: "16px",
            width: "88px",
            height: "128px",
            borderRadius: "14px",
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(12px)",
            border: "1.5px solid rgba(255, 255, 255, 0.25)",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3,
            transition: "opacity 0.3s ease",
            opacity: showControls ? 1 : 0
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16
            }}
          >
            👤
          </div>
          <span style={{ fontSize: "10px", marginTop: 4, opacity: 0.8 }}>Você</span>
        </div>

        {/* Barra Inferior de Controles (Mudo, Desligar, Alto-Falante) */}
        <footer
          style={{
            position: "relative",
            zIndex: 3,
            width: "100%",
            paddingBottom: "36px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "28px",
            transition: "opacity 0.3s ease",
            opacity: showControls ? 1 : 0
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Botão Microfone */}
          <button
            onClick={() => setIsMuted((prev) => !prev)}
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: isMuted ? "#ffffff" : "rgba(255,255,255,0.2)",
              color: isMuted ? "#000000" : "#ffffff",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
            }}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Botão Encerrar Chamada (Vermelho Grande) */}
          <button
            onClick={handleEndCall}
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              backgroundColor: "#ef4444",
              color: "#ffffff",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(239,68,68,0.5)",
              transform: "scale(1)",
              transition: "transform 0.15s ease"
            }}
          >
            <PhoneOff size={28} />
          </button>

          {/* Botão Alto-falante / Áudio */}
          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = isSpeaker;
              }
              setIsSpeaker((prev) => !prev);
            }}
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: isSpeaker ? "rgba(255,255,255,0.2)" : "#ffffff",
              color: isSpeaker ? "#ffffff" : "#000000",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
            }}
          >
            {isSpeaker ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
        </footer>
      </main>
    </>
  );
}
