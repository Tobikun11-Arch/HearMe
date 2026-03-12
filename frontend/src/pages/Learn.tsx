import {useEffect, useMemo, useState} from 'react';
import {motion} from 'framer-motion';
import LanguageCombobox from '@/components/LanguageCombobox';
import useUserCamera from '@/hooks/useUserCamera';

type LearnPath = 'basic' | 'subject';

type ProgressState = {
  learnPath: LearnPath;
  subject: string;
  language: string;
  signIndex: number;
};

const STORAGE_KEY = 'hearme.learn.progress.v1';

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

  const {videoRef, status, start} = useUserCamera();

  const subjectOptions = useMemo(() => {
    const base = ['Basic Sign Language', 'Science', 'Math', 'History'];
    return base;
  }, []);

  const activeSignList = useMemo(() => {
    if (learnPath === 'basic' || subject === 'Basic Sign Language')
      return BASIC_SIGNS;
    const list = SUBJECT_SIGNS[subject] ?? SUBJECT_SIGNS.Science;
    return list;
  }, [learnPath, subject]);

  const activeSign =
    activeSignList.length > 0
      ? activeSignList[
          Math.max(0, Math.min(signIndex, activeSignList.length - 1))
        ]
      : {id: 'unknown', title: 'Sign', meaning: ''};

  useEffect(() => {
    const payload: ProgressState = {learnPath, subject, language, signIndex};
    safeSetLocalStorageItem(STORAGE_KEY, JSON.stringify(payload));
  }, [language, learnPath, signIndex, subject]);

  const cameraStateLabel =
    status.state === 'active'
      ? 'Camera active'
      : status.state === 'requesting'
        ? 'Requesting camera permission'
        : status.state === 'blocked'
          ? 'Camera blocked'
          : 'Camera idle';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
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

          <div className="hidden sm:block text-right">
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="text-sm font-medium text-foreground">
              {cameraStateLabel}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                {activeSign.title}: {activeSign.meaning}
              </div>
            </div>
          </motion.section>

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
              <div className="mt-1 text-sm text-foreground leading-relaxed">
                Use the controls below to repeat the demo, try the sign, and
                continue.
              </div>
            </div>
          </motion.section>
        </div>

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
                    const fallback =
                      'This is a UI-only prototype. Next we can connect a real assistant or lesson database for richer explanations.';
                    setLastAnswer(
                      q ? `Question received: "${q}". ${fallback}` : fallback
                    );
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
