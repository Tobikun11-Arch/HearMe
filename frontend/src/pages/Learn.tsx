import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {motion} from 'framer-motion';
import LanguageCombobox from '@/components/LanguageCombobox';
import useUserCamera from '@/hooks/useUserCamera';
import {Hands} from '@mediapipe/hands';

type LearnPath = 'basic' | 'subject';

type ProgressState = {
  learnPath: LearnPath;
  subject: string;
  language: string;
  signIndex: number;
};

type WsEvent = {
  type: string;
  payload?: Record<string, unknown>;
};

type BackendStatusPayload = {
  geminiLive?: {
    enabled?: boolean;
    reason?: string;
  };
};

const STORAGE_KEY = 'hearme.learn.progress.v1';
const WS_URL = 'ws://localhost:8000/stream';
const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 20000;

const BASIC_SIGNS = [
  {id: 'hello', title: 'Hello', meaning: 'A common greeting.'},
  {id: 'thank-you', title: 'Thank you', meaning: 'An expression of gratitude.'},
  {id: 'help', title: 'Help', meaning: 'Request assistance.'}
];

const SUBJECT_SIGNS: Record<
  string,
  {id: string; title: string; meaning: string}[]
> = {
  Science: [
    {id: 'water', title: 'Water', meaning: 'A basic science word used daily.'},
    {
      id: 'experiment',
      title: 'Experiment',
      meaning: 'A test or investigation.'
    },
    {
      id: 'planet',
      title: 'Planet',
      meaning: 'A large object that orbits a star.'
    }
  ],
  Math: [
    {id: 'add', title: 'Add', meaning: 'Combine numbers.'},
    {id: 'equal', title: 'Equal', meaning: 'Two values are the same.'},
    {id: 'number', title: 'Number', meaning: 'A value used for counting.'}
  ],
  History: [
    {id: 'past', title: 'Past', meaning: 'Time that already happened.'},
    {id: 'country', title: 'Country', meaning: 'A nation or region.'},
    {id: 'leader', title: 'Leader', meaning: 'A person who guides others.'}
  ]
};

function safeParseProgress(value: string | null): ProgressState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ProgressState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.learnPath !== 'basic' && parsed.learnPath !== 'subject')
      return null;
    if (typeof parsed.subject !== 'string') return null;
    if (typeof parsed.language !== 'string') return null;
    if (typeof parsed.signIndex !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeGetLocalStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export default function Learn() {
  const saved = useMemo(
    () => safeParseProgress(safeGetLocalStorageItem(STORAGE_KEY)),
    []
  );

  const [learnPath, setLearnPath] = useState<LearnPath>(
    saved?.learnPath ?? 'basic'
  );
  const [subject, setSubject] = useState<string>(
    saved?.subject ?? 'Basic Sign Language'
  );
  const [language, setLanguage] = useState<string>(saved?.language ?? 'en');
  const [signIndex, setSignIndex] = useState<number>(saved?.signIndex ?? 0);

  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);

  const [captionText, setCaptionText] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<string | null>(null);
  const [lastFeedbackAt, setLastFeedbackAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [wsStatus, setWsStatus] = useState<
    'disconnected' | 'connecting' | 'ready'
  >('connecting');
  const [wsError, setWsError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<
    {ts: string; level: 'info' | 'warn' | 'error' | 'debug'; msg: string}[]
  >([]);
  const [showDebug, setShowDebug] = useState(false);
  const debugRef = useRef<HTMLDivElement | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mpHandsRef = useRef<unknown>(null);
  const lastLandmarksSentAtRef = useRef<number>(0);
  const targetSignIdRef = useRef<string>('');
  const targetSignLabelRef = useRef<string>('');
  const learnPathRef = useRef<LearnPath>(learnPath);
  const subjectRef = useRef<string>(subject);
  const languageRef = useRef<string>(language);

  // Reconnect state
  const reconnectDelayRef = useRef<number>(RECONNECT_BASE_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef<boolean>(false);

  const addLog = useCallback(
    (level: 'info' | 'warn' | 'error' | 'debug', msg: string) => {
      const ts = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setDebugLogs(prev => {
        const next = [...prev, {ts, level, msg}];
        return next.length > 200 ? next.slice(-200) : next;
      });
      // also mirror to browser console
      if (level === 'error') console.error('[hearme]', msg);
      else if (level === 'warn') console.warn('[hearme]', msg);
      else console.log('[hearme]', msg);
    },
    []
  );

  const {videoRef, status, start} = useUserCamera();

  useEffect(() => {
    learnPathRef.current = learnPath;
    subjectRef.current = subject;
    languageRef.current = language;
  }, [language, learnPath, subject]);

  // ── MediaPipe Hands (landmarks) ───────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (status.state !== 'active') return;

    type MpPoint = {x: number; y: number; z: number};
    type MpResults = {multiHandLandmarks?: MpPoint[][]};

    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results: MpResults) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const landmarks = results.multiHandLandmarks?.[0];
      if (!landmarks) return;

      // Throttle landmark sending (avoid flooding WS)
      const nowTs = Date.now();
      if (nowTs - lastLandmarksSentAtRef.current < 80) return;
      lastLandmarksSentAtRef.current = nowTs;

      ws.send(
        JSON.stringify({
          type: 'input.landmarks',
          payload: {
            ts: nowTs,
            landmarks: landmarks.map((p: MpPoint) => ({x: p.x, y: p.y, z: p.z}))
          }
        })
      );
    });
    mpHandsRef.current = hands;

    let rafId: number | null = null;
    const loop = async () => {
      try {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          await hands.send({image: video});
        }
      } catch {
        // ignore
      } finally {
        rafId = window.requestAnimationFrame(() => {
          void loop();
        });
      }
    };

    rafId = window.requestAnimationFrame(() => {
      void loop();
    });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      try {
        void (
          mpHandsRef.current as {close?: () => Promise<void> | void} | null
        )?.close?.();
      } catch {
        // ignore
      }
      mpHandsRef.current = null;
    };
  }, [status.state, videoRef]);

  // ── WebSocket with auto-reconnect ─────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (unmountedRef.current) return;

    setWsStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      reconnectDelayRef.current = RECONNECT_BASE_MS; // reset backoff on success
      setWsError(null);
      addLog('info', 'WS connected — sending session.start');
      ws.send(
        JSON.stringify({
          type: 'session.start',
          payload: {
            learnPath: learnPathRef.current,
            subject: subjectRef.current,
            spokenLanguage: languageRef.current,
            targetSignId: targetSignIdRef.current,
            targetSignLabel: targetSignLabelRef.current,
            client: {app: 'frontend', version: 'v1'}
          }
        })
      );
    };

    ws.onmessage = ev => {
      try {
        const data = JSON.parse(String(ev.data)) as WsEvent;

        if (data.type === 'status') {
          const p = (data.payload ?? {}) as BackendStatusPayload;
          const enabled = Boolean(p.geminiLive?.enabled);
          const reason = String(p.geminiLive?.reason ?? '');
          const label = enabled
            ? `Gemini: enabled (${reason})`
            : `Gemini: disabled (${reason})`;
          setGeminiStatus(label);
          addLog('info', `[status] ${label}`);
          return;
        }

        if (data.type === 'session.ready') {
          setWsStatus('ready');
          addLog('info', '[session.ready] Backend session is ready');
          return;
        }

        if (data.type === 'lesson.text') {
          const text = String(data.payload?.text ?? '');
          setCaptionText(text);
          addLog('debug', `[lesson.text] ${text.slice(0, 100)}`);
          return;
        }

        if (data.type === 'practice.feedback') {
          const correct = Boolean(data.payload?.correct);
          const reason = String(data.payload?.reason ?? '');
          const feedback = correct
            ? `✓ Correct! ${reason}`
            : `Try again. ${reason}`;
          setFeedbackText(feedback);
          setLastFeedbackAt(Date.now());
          addLog(
            correct ? 'info' : 'warn',
            `[feedback] correct=${correct}  reason="${reason}"`
          );
          return;
        }

        if (data.type === 'error') {
          const errMsg = String(data.payload?.message ?? 'Unknown error');
          setWsError(errMsg);
          addLog('error', `[error from backend] ${errMsg}`);
          return;
        }

        addLog('debug', `[ws msg] unhandled type="${data.type}"`);
      } catch {
        setWsError('Failed to parse backend message');
      }
    };

    ws.onerror = () => {
      setWsError('WebSocket connection error — retrying…');
      addLog('error', 'WS error event fired');
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (unmountedRef.current) return;

      setWsStatus('disconnected');
      addLog(
        'warn',
        `WS closed — reconnecting in ${reconnectDelayRef.current}ms`
      );

      // Exponential backoff reconnect
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);

      reconnectTimerRef.current = setTimeout(() => {
        // eslint-disable-next-line react-hooks/immutability
        if (!unmountedRef.current) connectWs();
      }, delay);
    };
  }, [addLog]);

  useEffect(() => {
    unmountedRef.current = false;
    connectWs();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connectWs]);

  // ── Send session.start when sign / settings change ────────────────────────
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    addLog(
      'info',
      `[session.start] sending  sign=${targetSignIdRef.current}  path=${learnPath}  subject=${subject}`
    );
    ws.send(
      JSON.stringify({
        type: 'session.start',
        payload: {
          learnPath,
          subject,
          spokenLanguage: language,
          targetSignId: targetSignIdRef.current,
          targetSignLabel: targetSignLabelRef.current,
          client: {app: 'frontend', version: 'v1'}
        }
      })
    );
    // Reset display state when sign changes
    addLog(
      'info',
      `[sign change] new sign: ${targetSignLabelRef.current} (${targetSignIdRef.current})`
    );
    setCaptionText(null);
    setFeedbackText(null);
    setLastFeedbackAt(null);
  }, [language, learnPath, signIndex, subject, addLog]);

  // ── Clock tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const subjectOptions = useMemo(
    () => ['Basic Sign Language', 'Science', 'Math', 'History'],
    []
  );

  const activeSignList = useMemo(() => {
    if (learnPath === 'basic' || subject === 'Basic Sign Language')
      return BASIC_SIGNS;
    return SUBJECT_SIGNS[subject] ?? SUBJECT_SIGNS.Science;
  }, [learnPath, subject]);

  const activeSign =
    activeSignList.length > 0
      ? activeSignList[
          Math.max(0, Math.min(signIndex, activeSignList.length - 1))
        ]
      : {id: 'unknown', title: 'Sign', meaning: ''};

  useEffect(() => {
    targetSignIdRef.current = activeSign.id;
    targetSignLabelRef.current = activeSign.title;
  }, [activeSign.id, activeSign.title]);

  useEffect(() => {
    const payload: ProgressState = {learnPath, subject, language, signIndex};
    safeSetLocalStorageItem(STORAGE_KEY, JSON.stringify(payload));
  }, [language, learnPath, signIndex, subject]);

  const cameraStateLabel =
    status.state === 'active'
      ? 'Camera active'
      : status.state === 'requesting'
        ? 'Requesting camera…'
        : status.state === 'blocked'
          ? 'Camera blocked'
          : 'Camera idle';

  const feedbackStale =
    lastFeedbackAt == null ? true : now - lastFeedbackAt > 4500;
  const feedbackAge =
    lastFeedbackAt == null ? null : Math.floor((now - lastFeedbackAt) / 1000);

  const wsStatusLabel =
    wsStatus === 'ready'
      ? 'Connected'
      : wsStatus === 'connecting'
        ? 'Connecting…'
        : 'Reconnecting…';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Interactive lesson
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Learn with a teacher avatar, practice with your camera open, and
              continue where you left off.
            </p>
          </div>

          <div className="hidden sm:block text-right shrink-0">
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="text-sm font-medium text-foreground">
              {cameraStateLabel}
            </div>
            <div className="text-xs text-muted-foreground mt-2">Backend</div>
            <div
              className={`text-sm font-medium ${
                wsStatus === 'ready'
                  ? 'text-green-600 dark:text-green-400'
                  : wsStatus === 'connecting'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-500'
              }`}
            >
              {wsStatusLabel}
            </div>
            {geminiStatus ? (
              <div className="mt-2">
                <div className="text-xs text-muted-foreground">AI</div>
                <div className="text-xs text-foreground max-w-56 text-right">
                  {geminiStatus}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Error banner */}
        {wsError ? (
          <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
            <div className="text-xs text-muted-foreground">Backend message</div>
            <div className="mt-1">{wsError}</div>
          </div>
        ) : null}

        {/* Main panels */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Teacher panel */}
          <motion.section
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.35}}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border">
              <div className="text-sm font-semibold text-foreground">
                AI Avatar Teacher
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Now teaching: {activeSign.title}
              </div>
            </div>

            <div className="aspect-video bg-muted/40 flex items-center justify-center">
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div
                  className="w-28 h-28 rounded-full bg-background border border-border"
                  style={{boxShadow: '0 10px 30px -18px rgba(0,0,0,.35)'}}
                />
                <div className="mt-4 text-sm font-medium text-foreground">
                  Teacher preview
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Static avatar for v1 (replace with video later)
                </div>
              </div>
            </div>

            <div className="px-5 py-4 bg-card">
              <div className="text-xs text-muted-foreground">
                Caption / translation
              </div>
              <div className="mt-1 text-sm text-foreground leading-relaxed">
                {captionText ?? `${activeSign.title}: ${activeSign.meaning}`}
              </div>
            </div>
          </motion.section>

          {/* Camera panel */}
          <motion.section
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.35, delay: 0.06}}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  User Camera
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Keep your hands visible for practice
                </div>
              </div>
              {status.state === 'blocked' ? (
                <button
                  type="button"
                  onClick={() => void start()}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:opacity-90"
                >
                  Retry
                </button>
              ) : null}
            </div>

            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                muted
                playsInline
              />
              {status.state === 'requesting' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-sm text-white">
                    Requesting camera permission
                  </div>
                </div>
              ) : null}
              {status.state === 'blocked' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-6">
                  <div className="max-w-md w-full rounded-xl border border-white/15 bg-black/40 p-4 text-white">
                    <div className="text-sm font-semibold">
                      Camera access needed
                    </div>
                    <div className="text-xs mt-2 opacity-90 leading-relaxed">
                      {status.message}
                    </div>
                    <div className="text-xs mt-3 opacity-80">
                      Enable camera permission for this site, then press Retry.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="px-5 py-4 bg-card">
              <div className="text-xs text-muted-foreground">
                Practice feedback
              </div>
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`mt-1 text-sm leading-relaxed font-medium ${
                    feedbackText?.startsWith('✓')
                      ? 'text-green-600 dark:text-green-400'
                      : feedbackText?.startsWith('Try')
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                  }`}
                >
                  {feedbackText ??
                    (wsStatus !== 'ready'
                      ? 'Waiting for backend connection…'
                      : status.state !== 'active'
                        ? 'Waiting for camera.'
                        : feedbackStale
                          ? 'No sign detected / waiting for analysis.'
                          : 'Waiting for analysis…')}
                </div>
                {feedbackAge !== null && !feedbackStale && (
                  <span className="mt-1 shrink-0 text-xs text-muted-foreground font-mono">
                    {feedbackAge}s ago
                  </span>
                )}
                {feedbackStale &&
                  wsStatus === 'ready' &&
                  status.state === 'active' && (
                    <span className="mt-1 shrink-0 text-xs text-yellow-500 font-mono animate-pulse">
                      ⟳ live
                    </span>
                  )}
              </div>
            </div>
          </motion.section>
        </div>

        {/* Controls */}
        <div
          className="mt-6 rounded-xl border border-border bg-card px-4 py-4"
          style={{
            boxShadow:
              '0 0 0 1px rgba(0,0,0,.02), 0 10px 30px -18px rgba(0,0,0,.18)'
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-4">
              <LanguageCombobox value={language} onChange={setLanguage} />
            </div>

            <div className="lg:col-span-4">
              <div className="text-xs text-muted-foreground mb-2">
                Learning track
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLearnPath('basic');
                    setSubject('Basic Sign Language');
                    setSignIndex(0);
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    learnPath === 'basic'
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted/40'
                  }`}
                >
                  Basic
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLearnPath('subject');
                    if (subject === 'Basic Sign Language')
                      setSubject('Science');
                    setSignIndex(0);
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    learnPath === 'subject'
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted/40'
                  }`}
                >
                  Subject
                </button>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="text-xs text-muted-foreground mb-2">Subject</div>
              <select
                value={subject}
                onChange={e => {
                  const next = e.target.value;
                  setSubject(next);
                  setLearnPath(
                    next === 'Basic Sign Language' ? 'basic' : 'subject'
                  );
                  setSignIndex(0);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {subjectOptions.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-12">
              <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Progress: {signIndex + 1} of {activeSignList.length}
                  {wsStatus === 'disconnected' ? (
                    <span className="ml-2 text-red-500">● Reconnecting…</span>
                  ) : wsStatus === 'connecting' ? (
                    <span className="ml-2 text-yellow-500">● Connecting…</span>
                  ) : (
                    <span className="ml-2 text-green-500">● Live</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAskOpen(true)}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40"
                  >
                    Ask question
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLastAnswer(null);
                      setCaptionText(null);
                      setFeedbackText(null);
                      setLastFeedbackAt(null);
                    }}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40"
                  >
                    Repeat demo
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(
                        signIndex + 1,
                        activeSignList.length - 1
                      );
                      setSignIndex(next);
                      setLastAnswer(null);
                      setCaptionText(null);
                      setFeedbackText(null);
                      setLastFeedbackAt(null);
                    }}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
                  >
                    Next sign
                  </button>
                </div>
              </div>

              {lastAnswer ? (
                <div className="mt-3 rounded-lg border border-border bg-background px-4 py-3">
                  <div className="text-xs text-muted-foreground">Assistant</div>
                  <div className="mt-1 text-sm text-foreground leading-relaxed">
                    {lastAnswer}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Debug log panel */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDebug(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-widest">
                Debug log
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                {debugLogs.length}
              </span>
              {debugLogs.some(l => l.level === 'error') && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-mono text-red-500">
                  {debugLogs.filter(l => l.level === 'error').length} error
                  {debugLogs.filter(l => l.level === 'error').length !== 1
                    ? 's'
                    : ''}
                </span>
              )}
              {debugLogs.some(l => l.level === 'warn') && (
                <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-mono text-yellow-600">
                  {debugLogs.filter(l => l.level === 'warn').length} warn
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setDebugLogs([]);
                }}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                Clear
              </button>
              <span className="text-xs text-muted-foreground">
                {showDebug ? '▲ hide' : '▼ show'}
              </span>
            </div>
          </button>

          {showDebug && (
            <div
              ref={debugRef}
              className="border-t border-border h-64 overflow-y-auto font-mono text-xs bg-black/90 p-3 space-y-0.5"
            >
              {debugLogs.length === 0 ? (
                <div className="text-white/30 py-4 text-center">
                  No logs yet
                </div>
              ) : (
                [...debugLogs].reverse().map((entry, i) => (
                  <div key={i} className="flex gap-2 leading-5">
                    <span className="text-white/30 shrink-0">{entry.ts}</span>
                    <span
                      className={`shrink-0 w-10 ${
                        entry.level === 'error'
                          ? 'text-red-400'
                          : entry.level === 'warn'
                            ? 'text-yellow-400'
                            : entry.level === 'debug'
                              ? 'text-white/40'
                              : 'text-green-400'
                      }`}
                    >
                      {entry.level}
                    </span>
                    <span
                      className={`break-all ${
                        entry.level === 'error'
                          ? 'text-red-300'
                          : entry.level === 'warn'
                            ? 'text-yellow-300'
                            : entry.level === 'debug'
                              ? 'text-white/50'
                              : 'text-white/90'
                      }`}
                    >
                      {entry.msg}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ask question modal */}
      {askOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Ask about this sign
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Current: {activeSign.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAskOpen(false);
                  setQuestion('');
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
              >
                Close
              </button>
            </div>

            <div className="p-5">
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                className="w-full min-h-28 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="Type your question about the meaning, usage, or when to use this sign"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAskOpen(false);
                    setQuestion('');
                  }}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const q = question.trim();
                    const ws = wsRef.current;
                    if (ws && ws.readyState === WebSocket.OPEN && q) {
                      ws.send(
                        JSON.stringify({
                          type: 'input.question',
                          payload: {
                            text: q,
                            signId: activeSign.id,
                            signLabel: activeSign.title
                          }
                        })
                      );
                      setLastAnswer(`Question sent: "${q}"`);
                    } else {
                      const fallback =
                        'Backend is not connected. Please wait for reconnection and try again.';
                      setLastAnswer(
                        q ? `Question received: "${q}". ${fallback}` : fallback
                      );
                    }
                    setAskOpen(false);
                    setQuestion('');
                  }}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
