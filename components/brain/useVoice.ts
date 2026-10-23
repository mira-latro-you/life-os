"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Mode = "speech" | "recorder" | "none";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

/**
 * Spracheingabe:
 * 1. Web Speech API (Safari/Chrome) → Live-Transkript direkt ins Textfeld
 * 2. Fallback: MediaRecorder-Aufnahme → wird an Gemini geschickt (transkribiert + routet)
 */
export function useVoice(opts: { onText: (text: string, final: boolean) => void; onAudio: (audio: { mimeType: string; data: string }) => void }) {
  const [mode, setMode] = useState<Mode>("none");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const baseText = useRef("");
  const cbRef = useRef(opts);
  cbRef.current = opts;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    if (w.SpeechRecognition || w.webkitSpeechRecognition) setMode("speech");
    else if (typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") setMode("recorder");
  }, []);

  const start = useCallback(
    async (currentText: string) => {
      setError(null);
      if (mode === "speech") {
        const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
        const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition)!;
        const rec = new Ctor();
        rec.lang = "de-DE";
        rec.interimResults = true;
        rec.continuous = true;
        baseText.current = currentText ? currentText.trimEnd() + " " : "";
        let finalText = "";
        rec.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText += r[0].transcript;
            else interim += r[0].transcript;
          }
          cbRef.current.onText((baseText.current + finalText + interim).trimStart(), false);
        };
        rec.onerror = (e) => {
          if (e.error === "not-allowed") setError("Mikrofon-Zugriff verweigert");
          else if (e.error !== "aborted" && e.error !== "no-speech") setError("Spracherkennung unterbrochen");
          setListening(false);
        };
        rec.onend = () => {
          setListening(false);
          cbRef.current.onText((baseText.current + finalText).trim(), true);
        };
        recRef.current = rec;
        rec.start();
        setListening(true);
        return;
      }

      if (mode === "recorder") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
          const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          const chunks: Blob[] = [];
          rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          rec.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            setListening(false);
            const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
            const buf = new Uint8Array(await blob.arrayBuffer());
            let bin = "";
            for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
            cbRef.current.onAudio({ mimeType: blob.type, data: btoa(bin) });
          };
          mediaRef.current = rec;
          rec.start();
          setListening(true);
        } catch {
          setError("Mikrofon-Zugriff verweigert");
        }
      }
    },
    [mode],
  );

  const stop = useCallback(() => {
    recRef.current?.stop();
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  }, []);

  return { supported: mode !== "none", mode, listening, error, start, stop };
}
