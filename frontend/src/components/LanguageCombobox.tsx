import {useEffect, useMemo, useRef, useState} from 'react';

type LanguageOption = {
  tag: string;
  label: string;
};

const FALLBACK_LANGUAGE_TAGS = [
  'af',
  'am',
  'ar',
  'as',
  'az',
  'be',
  'bg',
  'bn',
  'bs',
  'ca',
  'cs',
  'cy',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'eu',
  'fa',
  'fi',
  'fil',
  'fr',
  'ga',
  'gl',
  'gu',
  'ha',
  'he',
  'hi',
  'hr',
  'hu',
  'hy',
  'id',
  'ig',
  'is',
  'it',
  'ja',
  'jv',
  'ka',
  'kk',
  'km',
  'kn',
  'ko',
  'ku',
  'ky',
  'la',
  'lb',
  'lo',
  'lt',
  'lv',
  'mg',
  'mi',
  'mk',
  'ml',
  'mn',
  'mr',
  'ms',
  'mt',
  'my',
  'ne',
  'nl',
  'no',
  'ny',
  'or',
  'pa',
  'pl',
  'ps',
  'pt',
  'ro',
  'ru',
  'sd',
  'si',
  'sk',
  'sl',
  'so',
  'sq',
  'sr',
  'sv',
  'sw',
  'ta',
  'te',
  'tg',
  'th',
  'tk',
  'tr',
  'tt',
  'ug',
  'uk',
  'ur',
  'uz',
  'vi',
  'xh',
  'yi',
  'yo',
  'zh',
  'zu'
];

function getAllLanguageOptions(displayLocale: string): LanguageOption[] {
  const supportedValuesOf = (
    Intl as unknown as {supportedValuesOf?: (key: string) => string[]}
  ).supportedValuesOf;

  let tags: string[] = FALLBACK_LANGUAGE_TAGS;
  if (supportedValuesOf) {
    try {
      const maybe = supportedValuesOf('language');
      if (Array.isArray(maybe) && maybe.length > 0) tags = maybe;
    } catch {
      tags = FALLBACK_LANGUAGE_TAGS;
    }
  }
  const hasDisplayNames =
    typeof (Intl as unknown as {DisplayNames?: unknown}).DisplayNames ===
    'function';
  const displayNames = hasDisplayNames
    ? new Intl.DisplayNames([displayLocale], {type: 'language'})
    : null;

  const options = tags
    .map(tag => {
      let label = tag;
      if (displayNames) {
        try {
          label = displayNames.of(tag) ?? tag;
        } catch {
          label = tag;
        }
      }
      return {tag, label};
    })
    .filter((o, i, arr) => {
      if (!o.label) return false;
      const key = `${o.tag}|${o.label}`;
      return arr.findIndex(x => `${x.tag}|${x.label}` === key) === i;
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return options;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  displayLocale?: string;
  placeholder?: string;
};

export default function LanguageCombobox({
  value,
  onChange,
  displayLocale = 'en',
  placeholder = 'Search languages'
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(
    () => getAllLanguageOptions(displayLocale),
    [displayLocale]
  );

  const selectedLabel = useMemo(() => {
    const hasDisplayNames =
      typeof (Intl as unknown as {DisplayNames?: unknown}).DisplayNames ===
      'function';
    if (!hasDisplayNames) return value;
    try {
      const displayNames = new Intl.DisplayNames([displayLocale], {
        type: 'language'
      });
      return displayNames.of(value) ?? value;
    } catch {
      return value;
    }
  }, [displayLocale, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 80);

    const byLabel = options.filter(
      o => o.label.toLowerCase().includes(q) || o.tag.toLowerCase().includes(q)
    );

    return byLabel.slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="truncate">
            <div className="text-xs text-muted-foreground">Spoken language</div>
            <div className="font-medium truncate">{selectedLabel}</div>
          </div>
          <div className="text-xs text-muted-foreground">Select</div>
        </div>
      </button>

      {open ? (
        <div
          className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-card shadow-lg"
          role="listbox"
        >
          <div className="p-2 border-b border-border">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40"
              autoFocus
            />
            <div className="mt-2 text-xs text-muted-foreground">
              Showing up to 80 results
            </div>
          </div>

          <div className="max-h-64 overflow-auto p-1">
            {filtered.map(opt => {
              const active = opt.tag === value;
              return (
                <button
                  key={opt.tag}
                  type="button"
                  onClick={() => {
                    onChange(opt.tag);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50 ${
                    active ? 'bg-muted/60' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate">
                      <div className="font-medium truncate">{opt.label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {opt.tag}
                      </div>
                    </div>
                    {active ? (
                      <div className="text-xs font-medium text-accent">
                        Selected
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted-foreground">
                No matches
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
