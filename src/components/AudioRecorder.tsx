import React, { useState, useRef } from 'react';
import { Mic, Square, Trash, Play, Pause, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface AudioRecorderProps {
  onAudioReady: (base64Audio: string) => void;
  onCancel: () => void;
}

export default function AudioRecorder({ onAudioReady, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [simulationActive, setSimulationActive] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Start real recording
  const startRecording = async () => {
    setError(null);
    setAudioUrl(null);
    setBase64Data(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Convert blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setBase64Data(base64);
        };

        // Stop all tracks on the stream to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Erreur d\'accès au micro:', err);
      setError('Impossible d\'accéder au microphone. Vous pouvez utiliser le simulateur ci-dessous pour tester cette fonctionnalité !');
    }
  };

  // Stop real recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Simulate recording for preview/sandboxing if microphone is unavailable
  const startSimulation = () => {
    setError(null);
    setAudioUrl(null);
    setBase64Data(null);
    setIsRecording(true);
    setSimulationActive(true);
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration((prev) => {
        if (prev >= 4) {
          clearInterval(timerRef.current!);
          setIsRecording(false);
          setSimulationActive(false);

          // Standard beautiful pre-rendered tone representing the simulated voice note
          // This is a valid silent data URI of short duration so the player doesn't crash
          const simulatedBase64 = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
          setBase64Data(simulatedBase64);
          setAudioUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'); // Fallback public mp3 audio for player testing
          return 5;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handlePlayPause = () => {
    if (!audioUrl) return;
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(audioUrl);
      audioPlayerRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDiscard = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setAudioUrl(null);
    setBase64Data(null);
    setIsPlaying(false);
    setDuration(0);
    setError(null);
  };

  const handlePublish = () => {
    if (base64Data) {
      onAudioReady(base64Data);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-slate-100 shadow-md max-w-md mx-auto" id="audio-recorder-container">
      <div className="text-center mb-4">
        <h4 className="font-bold text-white text-base">Capsule Vocale 🎤</h4>
        <p className="text-xs text-slate-400 mt-1">
          {isRecording ? 'Enregistrement en cours...' : audioUrl ? 'Votre message est prêt' : 'Enregistrez un conseil ou un enseignement'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Visualizer Area */}
      <div className="bg-slate-950 rounded-xl h-24 mb-5 flex items-center justify-center relative overflow-hidden border border-slate-800">
        {isRecording ? (
          <div className="flex gap-1 items-center">
            <span className="w-1.5 h-6 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <span className="w-1.5 h-10 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            <span className="w-1.5 h-14 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-8 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            <span className="w-1.5 h-5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          </div>
        ) : audioUrl ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full transition shadow-md"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-slate-950" />}
            </button>
            <span className="text-sm font-mono text-emerald-400">Écouter la capsule ({formatTime(duration)})</span>
          </div>
        ) : (
          <div className="text-slate-500 flex flex-col items-center gap-1.5 text-xs">
            <Mic className="w-6 h-6 text-slate-600" />
            <span>Appuyez sur le micro pour parler</span>
          </div>
        )}

        {isRecording && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 text-xs text-red-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3">
        {!isRecording && !audioUrl && (
          <>
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-semibold rounded-xl transition shadow-md text-sm"
            >
              <Mic className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
            <button
              onClick={startSimulation}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-emerald-400 rounded-xl transition text-sm font-medium"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Simuler (Test)</span>
            </button>
          </>
        )}

        {isRecording && (
          <button
            onClick={simulationActive ? () => {} : stopRecording}
            disabled={simulationActive}
            className={`flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-xl transition shadow-md text-sm ${simulationActive ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Square className="w-4 h-4" />
            <span>{simulationActive ? 'Enregistrement test...' : 'Arrêter'}</span>
          </button>
        )}

        {audioUrl && (
          <>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-sm"
            >
              <Trash className="w-4 h-4" />
              <span>Recommencer</span>
            </button>
            <button
              onClick={handlePublish}
              className="flex items-center gap-1 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl transition shadow-md text-sm"
            >
              <span>Publier</span>
            </button>
          </>
        )}

        <button
          onClick={onCancel}
          className="px-4 py-2.5 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition text-sm"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
