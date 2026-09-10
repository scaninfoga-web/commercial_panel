'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock, Mail, X } from 'lucide-react';

// ============================================================
// EMAIL DOMAINS - most common domains show up first
// ============================================================
const EMAIL_DOMAINS = [
  // everyday consumer domains
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'rediffmail.com',
  'yahoo.co.in',
  'microsoft.com',

  // privacy focused mail providers
  'proton.me',
  'protonmail.com',
  'tutanota.com',
  'tuta.com',
  'mailfence.com',
  'zoho.com',

  // government and org domains
  'gov.in',
  'nic.in',
  'scaninfoga.com',
  'scaninfoga.in',
] as const;

// ============================================================
// TYPES
// ============================================================
interface EmailSuggestion {
  full: string;
  localPart: string;
  domain: string;
  matched: boolean;
}

interface EmailInputAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  maxSuggestions?: number;
  className?: string;
  onSuggestionSelect?: (suggestion: EmailSuggestion) => void;
}

// ============================================================
// HELPERS
// ============================================================

// joins class names and drops any falsy value
function combineClasses(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// splits "name@domain" into its two parts
function parseEmailInput(input: string): {
  localPart: string;
  domainPart: string;
} {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed.includes('@')) {
    return { localPart: trimmed, domainPart: '' };
  }

  const atIndex = trimmed.indexOf('@');
  return {
    localPart: trimmed.slice(0, atIndex),
    domainPart: trimmed.slice(atIndex + 1),
  };
}

// checks the part before the @ is a valid email local part
function isValidLocalPart(localPart: string): boolean {
  if (!localPart) return false;
  if (localPart.length > 64) return false;
  if (localPart.includes(' ')) return false;

  return /^[a-zA-Z0-9._%+-]+$/.test(localPart);
}

// builds the dropdown suggestion list from whatever the user typed
function getEmailSuggestions(
  input: string,
  maxSuggestions = 5,
): EmailSuggestion[] {
  if (!input || input.trim().length === 0) return [];

  const { localPart, domainPart } = parseEmailInput(input);
  if (!isValidLocalPart(localPart)) return [];

  const matchingDomains = domainPart
    ? EMAIL_DOMAINS.filter((domain) => domain.startsWith(domainPart))
    : EMAIL_DOMAINS.slice();

  return matchingDomains.slice(0, maxSuggestions).map((domain) => ({
    full: `${localPart}@${domain}`,
    localPart,
    domain,
    matched: domainPart.length > 0,
  }));
}

// simple full-email format check, used to show the check mark
function isCompleteEmail(input: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.trim());
}

// ============================================================
// ANIMATION
// ============================================================
const dropdownVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.15, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: { duration: 0.1, ease: 'easeIn' as const },
  },
};

// ============================================================
// COMPONENT
// ============================================================
export default function EmailInputAutocomplete({
  value,
  onChange,
  placeholder = 'you@company.com',
  error = false,
  disabled = false,
  maxSuggestions = 4,
  className = '',
  onSuggestionSelect,
}: EmailInputAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // load last used emails from the browser on first render
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent_email_addresses');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecentEmails(parsed.slice(0, 3));
      }
    } catch {
      // storage may be blocked (private mode) - fail silently
    }
  }, []);

  // recompute suggestions only when the typed value changes
  const suggestions = useMemo(() => {
    if (!value || value.trim().length === 0) return [];
    return getEmailSuggestions(value, maxSuggestions);
  }, [value, maxSuggestions]);

  const isValidEmail = useMemo(() => isCompleteEmail(value), [value]);

  // close the dropdown when the user clicks outside the field
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // reset highlighted row whenever the suggestion list changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  // keep the highlighted row visible while using arrow keys
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeElement = listRef.current.children[
        activeIndex
      ] as HTMLElement;
      activeElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // remember a picked email for next time (max 3, most recent first)
  const saveRecentEmail = useCallback((email: string) => {
    try {
      const stored = localStorage.getItem('recent_email_addresses');
      const recent = stored ? JSON.parse(stored) : [];
      const updated = [
        email,
        ...recent.filter((e: string) => e !== email),
      ].slice(0, 3);
      localStorage.setItem('recent_email_addresses', JSON.stringify(updated));
      setRecentEmails(updated);
    } catch {
      // storage may be blocked - fail silently
    }
  }, []);

  // apply a suggestion to the input
  const handleSelect = useCallback(
    (suggestion: EmailSuggestion) => {
      onChange(suggestion.full);
      setIsOpen(false);
      setActiveIndex(-1);

      if (isCompleteEmail(suggestion.full)) saveRecentEmail(suggestion.full);

      onSuggestionSelect?.(suggestion);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onChange, saveRecentEmail, onSuggestionSelect],
  );

  // full keyboard control: arrows to move, enter to pick, esc to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen && suggestions.length > 0) {
            setIsOpen(true);
            setActiveIndex(0);
          } else if (suggestions.length > 0) {
            setActiveIndex((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : 0,
            );
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (suggestions.length > 0) {
            setActiveIndex((prev) =>
              prev > 0 ? prev - 1 : suggestions.length - 1,
            );
          }
          break;

        case 'Enter':
          if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
            e.preventDefault();
            handleSelect(suggestions[activeIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);
          break;

        case 'Tab':
          setIsOpen(false);
          setActiveIndex(-1);
          break;

        default:
          break;
      }
    },
    [disabled, isOpen, suggestions, activeIndex, handleSelect],
  );

  // clear the field and refocus it
  const clearInput = useCallback(() => {
    onChange('');
    setIsOpen(false);
    setActiveIndex(-1);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onChange]);

  // recent emails only make sense when the field is empty
  const showRecentEmails = value.trim() === '' && recentEmails.length > 0;

  // pick which trailing icon to show: a clear button or a valid check mark
  const trailingIcon: 'clear' | 'valid' | null =
    value && !disabled && !isValidEmail
      ? 'clear'
      : isValidEmail && !error
        ? 'valid'
        : null;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        {/* text field */}
        <input
          ref={inputRef}
          type="email"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(e.target.value.trim().length > 0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (value.trim().length > 0 || recentEmails.length > 0)
              setIsOpen(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-label="Email address"
          aria-autocomplete="list"
          aria-expanded={isOpen && suggestions.length > 0}
          role="combobox"
          className={combineClasses(
            'h-12 w-full rounded-xl border bg-white/[0.03] px-4 text-sm text-white placeholder-zinc-500 backdrop-blur-xl transition focus:outline-none focus:ring-1',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
              : 'border-white/10 focus:border-emerald-400 focus:ring-emerald-400/20',
            isFocused && !error && 'border-emerald-500/50',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        />

        {/* clear button / valid check mark, centered on the right */}
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <AnimatePresence mode="wait" initial={false}>
            {trailingIcon === 'clear' && (
              <motion.button
                key="clear-button"
                type="button"
                onClick={clearInput}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="pointer-events-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white/10 text-zinc-400 transition-colors hover:bg-emerald-500/20 hover:text-emerald-300"
                aria-label="Clear email"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            )}

            {trailingIcon === 'valid' && (
              <motion.div
                key="valid-check"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="flex h-6 w-6 items-center justify-center"
              >
                <Check className="h-4 w-4 text-emerald-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* suggestion dropdown */}
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            key="dropdown"
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0A0E17] shadow-2xl shadow-black/40"
          >
            {/* recent emails, shown only when field is empty */}
            {showRecentEmails && (
              <div className="border-b border-white/10 p-1">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Recent
                </p>
                {recentEmails.map((email) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => {
                      const [local, domain] = email.split('@');
                      handleSelect({
                        full: email,
                        localPart: local,
                        domain,
                        matched: false,
                      });
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-emerald-500/10 hover:text-white"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-emerald-400/60" />
                    <span className="truncate">{email}</span>
                  </button>
                ))}
              </div>
            )}

            {/* domain suggestions */}
            {suggestions.length > 0 && (
              <ul
                ref={listRef}
                role="listbox"
                aria-label="Email suggestions"
                className="max-h-60 overflow-y-auto p-1"
              >
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.full}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(suggestion);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={combineClasses(
                      'flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors duration-100',
                      index === activeIndex
                        ? 'bg-emerald-500/15 text-white ring-1 ring-emerald-400/20'
                        : 'text-zinc-300 hover:bg-emerald-500/10',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-400/60" />
                      <span className="truncate">
                        <span className="text-zinc-300">
                          {suggestion.localPart}
                        </span>
                        <span className="text-zinc-500">@</span>
                        <span
                          className={
                            suggestion.matched
                              ? 'font-medium text-emerald-400'
                              : 'font-medium text-cyan-300'
                          }
                        >
                          {suggestion.domain}
                        </span>
                      </span>
                    </div>

                    {index === activeIndex && (
                      <span className="ml-2 shrink-0 text-xs text-emerald-400">
                        ↵
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* nothing matched */}
            {suggestions.length === 0 &&
              !showRecentEmails &&
              value.trim().length > 0 && (
                <div className="p-4 text-center">
                  <p className="text-xs text-zinc-500">No suggestions found</p>
                </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
