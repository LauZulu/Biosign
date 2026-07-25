'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

declare global {
  interface Window {
    [key: string]: any;
  }
}

type Landmark = { x: number; y: number; z: number };
type HandResults = {
  multiHandLandmarks?: Landmark[][];
  multiHandedness?: Array<{ label: string }>;
};

const TIP_INDEX = 8;
const TIP_MIDDLE = 12;
const TIP_RING = 16;
const TIP_PINKY = 20;
const PIP_INDEX = 6;
const PIP_MIDDLE = 10;
const PIP_RING = 14;
const PIP_PINKY = 18;
const THUMB_TIP = 4;
const THUMB_IP = 3;
const WRIST = 0;

const isFingerUp = (landmarks: Landmark[], tipIndex: number, pipIndex: number) => {
  return landmarks[tipIndex].y < landmarks[pipIndex].y;
};

const isThumbUp = (landmarks: Landmark[]) => {
  const tip = landmarks[THUMB_TIP];
  const ip = landmarks[THUMB_IP];
  const wrist = landmarks[WRIST];

  const tipDistance = Math.abs(tip.x - wrist.x);
  const ipDistance = Math.abs(ip.x - wrist.x);

  return tipDistance > ipDistance + 0.02;
};

const highlightCode = (code: string) => {
  const parts: Array<{ text: string; style?: CSSProperties }> = [];
  const tokenRegex = /(\s+|#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:def|class|import|from|return|if|elif|else|for|while|in|and|or|not|try|except|with|as|pass|break|continue|True|False|None)\b|\b\d+\b|[{}()\[\],.:;])/gm;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: code.slice(lastIndex, match.index) });
    }

    const token = match[0];
    const isKeyword = /\b(?:def|class|import|from|return|if|elif|else|for|while|in|and|or|not|try|except|with|as|pass|break|continue|True|False|None)\b/.test(token);
    const isString = /^(["']).*\1$/.test(token) || token.startsWith('"') || token.startsWith("'");
    const isComment = token.startsWith('#');
    const isNumber = /^\d+$/.test(token);

    parts.push({
      text: token,
      style: isKeyword
        ? { color: '#7dd3fc' }
        : isString
          ? { color: '#f9a8d4' }
          : isComment
            ? { color: '#6ee7b7' }
            : isNumber
              ? { color: '#fbbf24' }
              : undefined,
    });

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < code.length) {
    parts.push({ text: code.slice(lastIndex) });
  }

  return parts;
};

type ProteinOption = {
  id: string;
  name: string;
  disease: string;
  file: string;
  pdbId: string;
  accent: string;
};

const proteinOptions: ProteinOption[] = [
  { id: 'tp53', name: 'TP53', disease: 'Cancer', file: '/1TUP.pdb', pdbId: '1TUP', accent: '#22d3ee' },
  { id: 'lrrk2', name: 'LRRK2', disease: 'Parkinson', file: '/7LI4.pdb', pdbId: '7LI4', accent: '#f472b6' },
  { id: 'amyloid-beta', name: 'Amyloid beta', disease: 'Alzheimer', file: '/1IYT.pdb', pdbId: '1IYT', accent: '#34d399' },
];

const clasificarGesto = (landmarks: Landmark[]) => {
  const thumbUp = isThumbUp(landmarks);
  const indexUp = isFingerUp(landmarks, TIP_INDEX, PIP_INDEX);
  const middleUp = isFingerUp(landmarks, TIP_MIDDLE, PIP_MIDDLE);
  const ringUp = isFingerUp(landmarks, TIP_RING, PIP_RING);
  const pinkyUp = isFingerUp(landmarks, TIP_PINKY, PIP_PINKY);

  const mainFingerCount = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;
  const allFingersUp = thumbUp && indexUp && middleUp && ringUp && pinkyUp;
  const onlyThumbUp = thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp;
  const noFingersUp = !thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp;

  if (allFingersUp) return 'OPEN_HAND';
  if (onlyThumbUp) return 'THUMBS_UP';
  if (noFingersUp) return 'FIST';
  if (mainFingerCount === 1 && !thumbUp) return 'ONE';
  if (mainFingerCount === 2 && !thumbUp) return 'TWO';
  if (mainFingerCount === 3 && !thumbUp) return 'THREE';

  return 'UNKNOWN';
};

const gestureAgentMap: Record<string, { label: string; agentName: string; promptRole: string }> = {
  OPEN_HAND: {
    label: 'OPEN HAND',
    agentName: 'Educator Agent',
    promptRole: 'Explain what this protein is, in simple accessible language anyone can understand. 3-4 sentences.',
  },
  ONE: {
    label: 'ONE FINGER',
    agentName: 'Research Agent',
    promptRole: 'Summarize what scientific research and literature reveal about this protein: key discoveries, its role in disease research, and why researchers study it. Synthesize known findings from your knowledge. 3-4 sentences.',
  },
  TWO: {
    label: 'TWO FINGERS',
    agentName: 'Orchestration (multi-agent)',
    promptRole: 'Run a 3-step orchestration in a single structured response: (a) a Structure sub-agent describes the protein\'s structure, (b) a Disease sub-agent explains its link to the disease, (c) a Therapy sub-agent notes therapeutic angles. Then a Synthesizer combines them into one integrated insight. Return each step clearly labeled so the orchestration is visible in the panel.',
  },
  THREE: {
    label: 'THREE FINGERS',
    agentName: 'Curiosity Agent',
    promptRole: 'Share one fascinating, surprising \"did you know\" fact about this protein that sparks curiosity. 2-3 sentences, engaging.',
  },
  THUMBS_UP: {
    label: 'THUMBS UP',
    agentName: 'Frontier Agent',
    promptRole: 'Describe what scientists are researching RIGHT NOW about this protein and the future hope/therapeutic directions. 3-4 sentences, inspiring.',
  },
  FIST: {
    label: 'FIST',
    agentName: 'Biologist Agent',
    promptRole: 'Give a short technical structural analysis of this protein (domains, folds, key features). 3-4 sentences.',
  },
};

const gestureOrder: Array<keyof typeof gestureAgentMap> = ['OPEN_HAND', 'ONE', 'TWO', 'THREE', 'THUMBS_UP', 'FIST'];

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const proteinContainerRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<any>(null);
  const handsRef = useRef<any>(null);
  const proteinViewerRef = useRef<any>(null);

  const [status, setStatus] = useState('Requesting camera access...');
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [handCount, setHandCount] = useState(0);
  const [selectedProtein, setSelectedProtein] = useState<ProteinOption>(proteinOptions[0]);
  const [agentStatus, setAgentStatus] = useState('Usa la mano abierta para activar el Agente Educador.');
  const [agentExplanation, setAgentExplanation] = useState('Abre tu mano para comenzar una explicación sencilla de la proteína seleccionada.');
  const [activeAgent, setActiveAgent] = useState('Esperando señal');
  const [loadingClaude, setLoadingClaude] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [orchestrationSteps, setOrchestrationSteps] = useState<Array<{ label: string; output: string }>>([]);
  const [confirmedGesture, setConfirmedGesture] = useState('UNKNOWN');
  const [language, setLanguage] = useState<'ES' | 'EN'>('ES');
  const [pendingGesture, setPendingGesture] = useState('UNKNOWN');
  const [gestureToFetch, setGestureToFetch] = useState('UNKNOWN');
  const [triggerToken, setTriggerToken] = useState(0);
  const [confirmProgress, setConfirmProgress] = useState(0);

  const t = {
    title: language === 'ES' ? 'BioSign · Biología con control gestual' : 'BioSign · Hand-first computational biology',
    subtitle: language === 'ES' ? 'El seguimiento de manos en tiempo real se mantiene activo mientras una vista 3D de proteínas en vivo muestra TP53.' : 'Real-time hand tracking stays active while a live 3D protein view brings TP53 into focus.',
    selectProtein: language === 'ES' ? 'Seleccionar proteína' : 'Select protein',
    panel3DDescription: language === 'ES' ? `Se carga y renderiza en movimiento una estructura 3D real de ${selectedProtein.name}.` : `A real 3D structure for ${selectedProtein.name} is loaded and rendered in motion inside this panel.`,
    structureSource: language === 'ES' ? `Fuente de la estructura: Banco de Datos de Proteínas RCSB · ID ${selectedProtein.pdbId}` : `Structure source: RCSB Protein Data Bank · ID ${selectedProtein.pdbId}`,
    agentPanelTitle: language === 'ES' ? 'Panel de agentes' : 'Agent panel',
    agentPanelDescription: language === 'ES' ? 'Usa detección de gestos o estos botones para activar cada agente de forma confiable durante tu demo.' : 'Use either gesture detection or these buttons to activate each agent reliably during your demo.',
    activateButton: language === 'ES' ? 'Activar' : 'Activate',
    gestureLegend: language === 'ES' ? 'Leyenda de gestos' : 'Gesture legend',
    activeAgentLabel: language === 'ES' ? 'Agente activo:' : 'Active agent:',
    statusLabel: language === 'ES' ? 'Estado:' : 'Status:',
    confirming: language === 'ES' ? 'Confirmando' : 'Confirming',
    generating: language === 'ES' ? `El agente está explicando ${selectedProtein.name}...` : `Agent is explaining ${selectedProtein.name}...`,
    aiDisclaimer: language === 'ES' ? 'Síntesis generada por IA · no es una fuente médica verificada' : 'AI-generated synthesis · not a verified medical source',
    languageLabel: language === 'ES' ? 'Idioma:' : 'Language:',
    englishLabel: 'English',
    spanishLabel: 'Español',
    fps: 'FPS',
    hands: language === 'ES' ? 'Manos' : 'Hands',
    panelLanguageNote: language === 'ES' ? 'Idioma:' : 'Language:',
    waitingForStableSign: language === 'ES' ? 'Esperando gesto estable...' : 'Waiting for stable sign...',
    signConfirmed: language === 'ES' ? 'Gesto confirmado.' : 'Sign confirmed.',
    noAnswer: language === 'ES' ? 'No se recibió respuesta.' : 'No answer received.',
    agentErrorPrefix: language === 'ES' ? 'Error del agente:' : 'Agent error:',
    openHandPrompt: language === 'ES' ? 'Abre tu mano para comenzar una explicación sencilla de la proteína seleccionada.' : 'Open your hand to start a simple explanation of the selected protein.',
    activeByButton: (agent: string, protein: string) => language === 'ES' ? `${agent} activado por botón para ${protein}.` : `${agent} activated by button for ${protein}.`,
    readyToWork: (agent: string, protein: string) => language === 'ES' ? `${agent} listo para trabajar en ${protein}.` : `${agent} ready to work on ${protein}.`,
    cameraActive: language === 'ES' ? 'Cámara activa' : 'Camera active',
    cameraStopped: language === 'ES' ? 'Cámara detenida' : 'Camera stopped',
    cameraError: language === 'ES' ? 'No se pudo acceder a la cámara' : 'Could not access the camera',
    cameraNotSupported: language === 'ES' ? 'Tu navegador no soporta el acceso a la cámara.' : 'Your browser does not support camera access.',
    prepareCanvasError: language === 'ES' ? 'No se pudo preparar el lienzo de superposición.' : 'Could not prepare the overlay canvas.',
    waitingForOpenHand: language === 'ES' ? 'Usa la mano abierta para activar el Agente Educador.' : 'Waiting for an open hand to activate the Educator Agent.',
    workingOn: (agent: string, protein: string) => language === 'ES' ? `${agent} trabajando en ${protein}...` : `${agent} working on ${protein}...`,
    agentErrorStatus: (agent: string) => language === 'ES' ? `Error de ${agent}` : `${agent} error`,
    languageButton: language === 'ES' ? 'Español' : 'English',
  };
  const pendingGestureRef = useRef('UNKNOWN');
  const confirmedGestureRef = useRef('UNKNOWN');
  const gestureStartRef = useRef(performance.now());

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Could not prepare the overlay canvas.');
      return;
    }

    let cancelled = false;
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    const initializeMediaPipe = async () => {
      try {
        const [{ Hands, HAND_CONNECTIONS }, { Camera }, { drawConnectors, drawLandmarks }] = await Promise.all([
          import('@mediapipe/hands'),
          import('@mediapipe/camera_utils'),
          import('@mediapipe/drawing_utils'),
        ]);

        if (cancelled) return;

        const hands = new Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        const onResults = (results: HandResults) => {
          const detectedHands = results.multiHandLandmarks?.length ?? 0;
          setHandCount(detectedHands);

          frameCount += 1;
          const now = performance.now();
          if (now - lastFpsUpdate >= 1000) {
            setFps(frameCount);
            frameCount = 0;
            lastFpsUpdate = now;
          }

          const width = video.videoWidth || 640;
          const height = video.videoHeight || 480;

          canvas.width = width;
          canvas.height = height;

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(video, 0, 0, width, height);

          if (results.multiHandLandmarks) {
            results.multiHandLandmarks.forEach((landmarks) => {
              drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
                color: '#22c55e',
                lineWidth: 3,
              });
              drawLandmarks(ctx, landmarks, {
                color: '#f8fafc',
                lineWidth: 1,
                radius: 4,
              });
            });
          }

          let frameGesture = 'UNKNOWN';
          if (results.multiHandLandmarks?.[0]) {
            const landmarks = results.multiHandLandmarks[0];
            frameGesture = clasificarGesto(landmarks);
          }

          if (frameGesture === pendingGestureRef.current) {
            const elapsed = now - gestureStartRef.current;
            const progress = Math.min(1, elapsed / 600);
            setConfirmProgress(progress);

            if (progress === 1 && frameGesture !== confirmedGestureRef.current) {
              confirmedGestureRef.current = frameGesture;
              setConfirmedGesture(frameGesture);
              setGestureToFetch(frameGesture);
              setTriggerToken((value) => value + 1);
              const gestureConfig = gestureAgentMap[frameGesture];
              if (gestureConfig) {
                setAgentStatus(`${gestureConfig.agentName} ready to work on ${selectedProtein.name}.`);
                setActiveAgent(gestureConfig.agentName);
              } else {
                setAgentStatus('Sign confirmed.');
                setActiveAgent('No active agent');
              }
            }
          } else {
            pendingGestureRef.current = frameGesture;
            setPendingGesture(frameGesture);
            gestureStartRef.current = now;
            setConfirmProgress(0);
            setAgentStatus('Waiting for stable sign...');
          }
        };

        hands.onResults(onResults);

        const camera = new Camera(video, {
          onFrame: async () => {
            await hands.send({ image: video });
          },
          width: 640,
          height: 480,
        });

        cameraRef.current = camera;
        handsRef.current = hands;

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Your browser does not support camera access.');
        }

        await camera.start();
        setStatus('Camera active');
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Could not start the camera.';
        setError(message);
        setStatus('Could not access the camera');
      }
    };

    void initializeMediaPipe();

    return () => {
      cancelled = true;
      const camera = cameraRef.current;
      const hands = handsRef.current;
      if (camera) {
        camera.stop();
      }
      if (hands) {
        hands.close();
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      if (video.srcObject) {
        video.srcObject = null;
      }
      cameraRef.current = null;
      handsRef.current = null;
      setStatus('Camera stopped');
    };
  }, []);
  useEffect(() => {
    const container = proteinContainerRef.current;
    if (!container) {
      return;
    }

    const initProteinViewer = async () => {
      if (!window?.['3Dmol']) {
        return;
      }

      if (proteinViewerRef.current) {
        proteinViewerRef.current.clear();
      }

      container.innerHTML = '';
      container.style.position = 'relative';

      try {
        const response = await fetch(selectedProtein.file);
        if (!response.ok) {
          throw new Error(`Unable to load ${selectedProtein.file} (${response.status})`);
        }

        const pdbText = await response.text();
        console.log(`[BioSign] Loaded local PDB model from ${selectedProtein.file}`);

        const viewer = window['3Dmol'].createViewer(container, {
          backgroundColor: 'rgba(2, 6, 23, 1)',
          antialias: true,
        });

        viewer.addModel(pdbText, 'pdb');
        viewer.setStyle({ cartoon: { color: 'spectrum' } });
        viewer.zoomTo();
        viewer.render();
        if (typeof viewer.animate === 'function') {
          viewer.animate({ loop: 'backAndForth' });
        }
        proteinViewerRef.current = viewer;
        console.log(`[BioSign] 3Dmol viewer initialized for ${selectedProtein.name}`);
      } catch (error) {
        console.error('[BioSign] Failed to initialize the protein viewer', error);
      }
    };

    if (typeof window !== 'undefined' && window?.['3Dmol']) {
      void initProteinViewer();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://3Dmol.csb.pitt.edu/build/3Dmol-min.js';
    script.async = true;
    script.onload = () => {
      void initProteinViewer();
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (proteinViewerRef.current) {
        proteinViewerRef.current.clear();
        proteinViewerRef.current = null;
      }
    };
  }, [selectedProtein]);

  const triggerAgent = (gestureKey: string) => {
    const gestureConfig = gestureAgentMap[gestureKey];
    if (!gestureConfig) {
      return;
    }

    setPendingGesture(gestureKey);
    setConfirmedGesture(gestureKey);
    setGestureToFetch(gestureKey);
    setTriggerToken((value) => value + 1);
    setActiveAgent(gestureConfig.agentName);
    setAgentStatus(`${gestureConfig.agentName} activated by button for ${selectedProtein.name}.`);
    setConfirmProgress(1);
  };

  useEffect(() => {
    const gestureConfig = gestureAgentMap[gestureToFetch];
    if (!gestureConfig) {
      return;
    }

    const generateAnswer = async () => {
      setAgentError(null);
      setLoadingClaude(true);
      setAgentExplanation('');
      setOrchestrationSteps([]);
      setActiveAgent(gestureConfig.agentName);
      setAgentStatus(`${gestureConfig.agentName} working on ${selectedProtein.name}...`);

      try {
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ gesture: gestureToFetch, protein: selectedProtein.name, pdbId: selectedProtein.pdbId }),
        });

        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        if (!response.ok) {
          let errorMessage = 'Agent unavailable, try again.';
          if (isJson) {
            const errorData = await response.json();
            errorMessage = errorData?.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
          throw new Error(errorMessage);
        }

        if (!isJson) {
          const text = await response.text();
          throw new Error(text || 'Agent unavailable, try again.');
        }

        const data = await response.json();
        setAgentExplanation(data.answer ?? 'No answer received.');
        setOrchestrationSteps(data.orchestration ?? []);
        setAgentStatus(`${gestureConfig.agentName} answer ready.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setAgentError(message);
        setAgentStatus(`${gestureConfig.agentName} error`);
      } finally {
        setLoadingClaude(false);
      }
    };

    generateAnswer();
  }, [triggerToken, gestureToFetch, selectedProtein]);

  return (
    <main style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '8px', fontSize: '28px' }}>BioSign · Hand-first computational biology</h1>
        <p style={{ marginTop: 0, color: '#94a3b8' }}>
          Real-time hand tracking stays active while a live 3D protein view brings TP53 into focus.
        </p>

        <div style={{ display: 'grid', gap: '16px', marginTop: '24px', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ padding: '10px 14px', background: '#0f172a', borderRadius: '999px', border: '1px solid #1e293b' }}>
                FPS: <strong>{fps}</strong>
              </div>
              <div style={{ padding: '10px 14px', background: '#0f172a', borderRadius: '999px', border: '1px solid #1e293b' }}>
                Hands: <strong>{handCount}</strong>
              </div>
              <div style={{ padding: '10px 14px', background: '#0f172a', borderRadius: '999px', border: '1px solid #1e293b' }}>
                Status: <strong>{status}</strong>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label htmlFor="protein-select" style={{ color: '#cbd5e1', fontSize: '14px' }}>
                Select protein
              </label>
              <select
                id="protein-select"
                value={selectedProtein.id}
                onChange={(event) => {
                  const protein = proteinOptions.find((item) => item.id === event.target.value);
                  if (protein) {
                    setSelectedProtein(protein);
                  }
                }}
                style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid #1e293b', background: '#0f172a', color: '#f8fafc' }}
              >
                {proteinOptions.map((protein) => (
                  <option key={protein.id} value={protein.id}>
                    {protein.name} · {protein.disease}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {proteinOptions.map((protein) => (
                  <span key={protein.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: '#020617', border: '1px solid #1e293b', fontSize: '12px', color: '#e2e8f0' }}>
                    <span style={{ color: protein.accent }}>●</span>
                    {protein.name} · {protein.disease}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', maxWidth: '720px', margin: '24px auto 0', width: '100%' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', borderRadius: '16px', background: '#111827', display: 'block' }}
              />
              <canvas
                ref={canvasRef}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '16px' }}
              />
            </div>

            {error ? (
              <p style={{ color: '#fda4af', margin: '16px 0 0' }}>{error}</p>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '18px', background: '#0f172a', borderRadius: '20px', border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedProtein.name} · {selectedProtein.disease}</h2>
                <span style={{ color: selectedProtein.accent, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{selectedProtein.disease}</span>
              </div>
              <p style={{ margin: '0 0 12px', color: '#94a3b8', fontSize: '14px' }}>
                A real 3D structure for {selectedProtein.name} is loaded and rendered in motion inside this panel.
              </p>
              <p style={{ margin: '0 0 16px', color: '#cbd5e1', fontSize: '13px' }}>
                Structure source: RCSB Protein Data Bank · ID {selectedProtein.pdbId}
              </p>
              <div
                ref={proteinContainerRef}
                style={{ width: '100%', height: '400px', minHeight: '400px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #1e293b', background: '#020617', position: 'relative' }}
              />
            </div>

            <aside style={{ padding: '20px', background: '#0f172a', borderRadius: '20px', border: '1px solid #1e293b' }}>
              <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>Agent panel</h2>
              <p style={{ margin: '0 0 12px', color: '#cbd5e1' }}>Use either gesture detection or these buttons to activate each agent reliably during your demo.</p>
              <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
                {gestureOrder.map((gestureKey) => {
                  const gestureConfig = gestureAgentMap[gestureKey];
                  return (
                    <button
                      key={gestureKey}
                      type="button"
                      onClick={() => triggerAgent(gestureKey)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        border: '1px solid #334155',
                        background: '#020617',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>
                        <strong>{gestureConfig.agentName}</strong> · {gestureConfig.label.toLowerCase()}
                      </span>
                      <span style={{ color: '#38bdf8', fontSize: '12px' }}>Activate</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '16px', background: '#020617', border: '1px solid #1e293b' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Gesture legend</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {gestureOrder.map((gestureKey) => {
                    const gestureConfig = gestureAgentMap[gestureKey];
                    return (
                      <div key={gestureKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: '#cbd5e1' }}>
                        <span>{gestureConfig.label}</span>
                        <span style={{ color: '#94a3b8' }}>{gestureConfig.agentName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Gesture:</strong> <span>{confirmedGesture}</span>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Active agent:</strong> <span>{activeAgent}</span>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Status:</strong> <span>{agentStatus}</span>
              </div>
              {pendingGesture !== 'UNKNOWN' && confirmedGesture !== pendingGesture && confirmProgress < 1 ? (
                <div style={{ marginTop: '12px', color: '#7dd3fc' }}>
                  Confirming {pendingGesture.toLowerCase().replace('_', ' ')}… ({Math.round(confirmProgress * 100)}%)
                </div>
              ) : null}
              {loadingClaude ? (
                <div style={{ marginTop: '16px', color: '#7dd3fc' }}>{gestureAgentMap[gestureToFetch]?.agentName || 'Agent'} is explaining {selectedProtein.name}...</div>
              ) : null}
              {agentError ? (
                <div style={{ marginTop: '16px', color: '#fda4af' }}>{agentError}</div>
              ) : null}
              {orchestrationSteps.length > 0 ? (
                <div style={{ marginTop: '16px', display: 'grid', gap: '14px' }}>
                  <div style={{ padding: '12px', borderRadius: '12px', background: '#020617', border: '1px solid #1e293b', color: '#e2e8f0' }}>
                    <strong>Orchestration pipeline</strong>
                    <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
                      {orchestrationSteps.map((step) => (
                        <div key={step.label} style={{ padding: '10px', borderRadius: '12px', background: '#0f172a', border: '1px solid #1e293b' }}>
                          <div style={{ marginBottom: '6px', color: '#94a3b8', fontSize: '13px' }}>{step.label} Agent</div>
                          <div style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: 1.7 }}>{step.output}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {agentExplanation ? (
                    <div style={{ padding: '12px', borderRadius: '12px', background: '#020617', border: '1px solid #1e293b', color: '#e2e8f0', lineHeight: 1.6 }}>
                      <div style={{ marginBottom: '8px', fontWeight: 600 }}>Synthesizer output</div>
                      {agentExplanation}
                      <div style={{ marginTop: '12px', color: '#94a3b8', fontSize: '12px' }}>
                        AI-generated synthesis · not a verified medical source
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : agentExplanation ? (
                <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: '#020617', border: '1px solid #1e293b', color: '#e2e8f0', lineHeight: 1.6 }}>
                  {agentExplanation}
                  <div style={{ marginTop: '12px', color: '#94a3b8', fontSize: '12px' }}>
                    AI-generated synthesis · not a verified medical source
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
