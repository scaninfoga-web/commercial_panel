"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  FileText,
  Fingerprint,
  Hash,
  IdCard,
  IndianRupee,
  Info,
  Landmark,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AgreementStatus =
  "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

const BUSINESS_TYPES = [
  "Sole Proprietorship",
  "Partnership",
  "LLP",
  "Private Limited",
  "Public Limited",
  "One Person Company",
  "Trust / Society",
] as const;

type BusinessType = (typeof BUSINESS_TYPES)[number];
type BusinessTypeValue = "" | BusinessType;

type DynamicKey =
  | "panNumber"
  | "gstNumber"
  | "cinNumber"
  | "dinNumber"
  | "udyamNumber"
  | "llpinNumber"
  | "partnershipRegNo"
  | "trustRegNo";

export interface CompanyForm {
  companyName: string;
  businessType: BusinessTypeValue;
  registeredAddress: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  useCase: string;
  panNumber: string;
  gstNumber: string;
  cinNumber: string;
  dinNumber: string;
  udyamNumber: string;
  llpinNumber: string;
  partnershipRegNo: string;
  trustRegNo: string;
}

export interface MSIAgreementPageProps {
  initialStatus?: AgreementStatus;
  initialData?: Partial<CompanyForm>;
  referenceId?: string;
  updatedAt?: string;
  rejectionReason?: string;
  onSubmit?: (data: CompanyForm) => Promise<void> | void;
  onDownload?: () => Promise<void> | void;
  onReturnPolicy?: () => Promise<void> | void;
  showDemoControls?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const EMPTY_FORM: CompanyForm = {
  companyName: "",
  businessType: "",
  registeredAddress: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  useCase: "",
  panNumber: "",
  gstNumber: "",
  cinNumber: "",
  dinNumber: "",
  udyamNumber: "",
  llpinNumber: "",
  partnershipRegNo: "",
  trustRegNo: "",
};

const DYNAMIC_KEYS: DynamicKey[] = [
  "panNumber",
  "gstNumber",
  "cinNumber",
  "dinNumber",
  "udyamNumber",
  "llpinNumber",
  "partnershipRegNo",
  "trustRegNo",
];

const IDENTITY_CONFIG: Record<
  BusinessType,
  { key: DynamicKey; required: boolean }[]
> = {
  "Sole Proprietorship": [
    { key: "udyamNumber", required: true },
    { key: "panNumber", required: true },
    { key: "gstNumber", required: false },
  ],
  Partnership: [
    { key: "partnershipRegNo", required: false },
    { key: "panNumber", required: true },
    { key: "gstNumber", required: false },
  ],
  LLP: [
    { key: "llpinNumber", required: true },
    { key: "panNumber", required: true },
    { key: "gstNumber", required: false },
  ],
  "Private Limited": [
    { key: "cinNumber", required: true },
    { key: "dinNumber", required: true },
    { key: "panNumber", required: true },
    { key: "gstNumber", required: false },
  ],
  "Public Limited": [
    { key: "cinNumber", required: true },
    { key: "dinNumber", required: true },
    { key: "panNumber", required: true },
    { key: "gstNumber", required: false },
  ],
  "One Person Company": [
    { key: "cinNumber", required: true },
    { key: "dinNumber", required: true },
    { key: "panNumber", required: true },
    { key: "gstNumber", required: false },
  ],
  "Trust / Society": [
    { key: "trustRegNo", required: true },
    { key: "panNumber", required: true },
    { key: "gstNumber", required: false },
  ],
};

const IDENTITY_DESCRIPTIONS: Record<BusinessType, string> = {
  "Sole Proprietorship":
    "Verified using your Udyam (MSME) registration and PAN. GST is only needed if you're registered.",
  Partnership:
    "Verified using the firm's PAN and GSTIN, plus your Registrar of Firms number if registered.",
  LLP: "Verified using the LLP Identification Number (LLPIN), the LLP's PAN, and GSTIN.",
  "Private Limited":
    "Verified using CIN, a director's DIN, the company PAN, and GSTIN.",
  "Public Limited":
    "Verified using CIN, a director's DIN, the company PAN, and GSTIN.",
  "One Person Company":
    "Verified using CIN, the director's DIN, the company PAN, and GSTIN.",
  "Trust / Society":
    "Verified using your trust deed / society registration number and PAN.",
};

/** Safe getters — avoid indexing a Record<BusinessType, T> with the "" default state. */
function getIdentityFields(
  type: BusinessTypeValue,
): { key: DynamicKey; required: boolean }[] {
  return type ? IDENTITY_CONFIG[type] : [];
}

function getIdentityDescription(type: BusinessTypeValue): string {
  return type ? IDENTITY_DESCRIPTIONS[type] : "";
}

function panLabelFor(t: BusinessTypeValue): string {
  switch (t) {
    case "Sole Proprietorship":
      return "Proprietor's PAN";
    case "Partnership":
      return "Firm's PAN";
    case "LLP":
      return "LLP's PAN";
    case "Trust / Society":
      return "Trust / Society PAN";
    default:
      return "Company PAN";
  }
}

const FIELD_META: Record<
  DynamicKey,
  {
    icon: typeof Hash;
    label: (t: BusinessTypeValue) => string;
    placeholder: string;
    maxLength?: number;
    inputMode?: "text" | "numeric";
    hint?: string;
    fullWidth?: boolean;
  }
> = {
  panNumber: {
    icon: IdCard,
    label: panLabelFor,
    placeholder: "ABCDE1234F",
    maxLength: 10,
  },
  gstNumber: {
    icon: IndianRupee,
    label: () => "GST number (Optional)",
    placeholder: "27AABCX1234P1ZZ",
    maxLength: 15,
  },
  cinNumber: {
    icon: Hash,
    label: () => "CIN number",
    placeholder: "U12345DL2020PTC123456",
    maxLength: 21,
    fullWidth: true,
  },
  dinNumber: {
    icon: Fingerprint,
    label: () => "Director DIN",
    placeholder: "12345678",
    maxLength: 8,
    inputMode: "numeric",
    hint: "Director Identification Number of an authorised signatory",
  },
  udyamNumber: {
    icon: BadgeCheck,
    label: () => "Udyam registration number",
    placeholder: "UDYAM-DL-02-1234567",
    maxLength: 19,
    hint: "As shown on your Udyam (MSME) certificate",
    fullWidth: true,
  },
  llpinNumber: {
    icon: Layers,
    label: () => "LLPIN",
    placeholder: "AAA-1234",
    maxLength: 10,
    hint: "LLP Identification Number from your Certificate of Incorporation",
  },
  partnershipRegNo: {
    icon: ClipboardCheck,
    label: () => "Partnership registration no.",
    placeholder: "RF/1234/2020",
    hint: "As issued by the Registrar of Firms — leave blank if unregistered",
    fullWidth: true,
  },
  trustRegNo: {
    icon: Landmark,
    label: () => "Trust / Society registration no.",
    placeholder: "REG/2020/00123",
    hint: "From your trust deed or society registration certificate",
    fullWidth: true,
  },
};

const STATUS_CONFIG: Record<
  AgreementStatus,
  {
    label: string;
    description: string;
    tone: "slate" | "sky" | "amber" | "emerald" | "red";
    icon: typeof CheckCircle2;
  }
> = {
  DRAFT: {
    label: "Draft",
    description: "Fill in your company details and submit to start the review.",
    tone: "slate",
    icon: FileText,
  },
  SUBMITTED: {
    label: "Submitted",
    description:
      "We have your details. The compliance queue picks this up next.",
    tone: "sky",
    icon: Send,
  },
  UNDER_REVIEW: {
    label: "Under review",
    description: "Our compliance team is verifying your company records.",
    tone: "amber",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    description: "Your MSI agreement is verified. Integration access is live.",
    tone: "emerald",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    description:
      "Something didn't match our records. Fix the details and resubmit.",
    tone: "red",
    icon: XCircle,
  },
};

const TONES = {
  slate: {
    border: "border-slate-500/30",
    bg: "bg-slate-500/10",
    text: "text-slate-300",
    ring: "ring-slate-500/20",
  },
  sky: {
    border: "border-sky-500/30",
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    ring: "ring-sky-500/20",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    ring: "ring-amber-500/20",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    ring: "ring-emerald-500/20",
  },
  red: {
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    text: "text-red-400",
    ring: "ring-red-500/20",
  },
} as const;

const TIMELINE: { key: AgreementStatus; label: string; hint: string }[] = [
  { key: "SUBMITTED", label: "Submitted", hint: "Details received" },
  {
    key: "UNDER_REVIEW",
    label: "Under review",
    hint: "Compliance check in progress",
  },
  { key: "APPROVED", label: "Approved", hint: "Integration access enabled" },
];

const STATUS_ORDER: AgreementStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
];

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

const PATTERNS = {
  din: /^\d{8}$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  gst: /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/,
  cin: /^[LUu]\d{5}[A-Za-z]{2}\d{4}[A-Za-z]{3}\d{6}$/,
  phone: /^[6-9]\d{9}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  udyam: /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/,
  llpin: /^[A-Z0-9-]{6,10}$/,
};

const BASE_REQUIRED: (keyof CompanyForm)[] = [
  "companyName",
  "businessType",
  "registeredAddress",
  "contactPerson",
  "contactEmail",
  "contactPhone",
];

function isDynamicKey(key: keyof CompanyForm): key is DynamicKey {
  return (DYNAMIC_KEYS as string[]).includes(key);
}

function isFieldRequired(
  key: DynamicKey,
  businessType: BusinessTypeValue,
): boolean {
  return getIdentityFields(businessType).some(
    (f) => f.key === key && f.required,
  );
}

function validateIdentityField(
  key: DynamicKey,
  raw: string,
  businessType: BusinessTypeValue,
): string | null {
  const v = raw.trim();
  const required = isFieldRequired(key, businessType);
  if (!v) return required ? "This field is required" : null;

  switch (key) {
    case "panNumber":
      return PATTERNS.pan.test(v) ? null : "PAN format: ABCDE1234F";
    case "gstNumber":
      return PATTERNS.gst.test(v)
        ? null
        : "GSTIN is 15 characters, e.g. 27AABCX1234P1ZZ";
    case "cinNumber":
      return PATTERNS.cin.test(v)
        ? null
        : "CIN is 21 characters, e.g. U12345DL2020PTC123456";
    case "dinNumber":
      return PATTERNS.din.test(v) ? null : "DIN is 8 digits";
    case "udyamNumber":
      return PATTERNS.udyam.test(v) ? null : "Format: UDYAM-XX-00-0000000";
    case "llpinNumber":
      return PATTERNS.llpin.test(v)
        ? null
        : "Enter a valid LLPIN, e.g. AAA-1234";
    case "partnershipRegNo":
    case "trustRegNo":
      return v.length < 4 ? "Enter a valid registration number" : null;
    default:
      return null;
  }
}

function validateField(
  key: keyof CompanyForm,
  raw: string,
  businessType: BusinessTypeValue,
): string | null {
  const v = raw.trim();

  if (key === "businessType") return v ? null : "Select a business type";
  if (isDynamicKey(key)) return validateIdentityField(key, raw, businessType);
  if (BASE_REQUIRED.includes(key) && !v) return "This field is required";

  switch (key) {
    case "companyName":
      return v.length < 3 ? "Enter the full registered company name" : null;
    case "registeredAddress":
      return v.length < 10 ? "Enter the full registered address" : null;
    case "contactPerson":
      return v.length < 3 ? "Enter the contact person's full name" : null;
    case "contactEmail":
      return PATTERNS.email.test(v) ? null : "Enter a valid email address";
    case "contactPhone":
      return PATTERNS.phone.test(v)
        ? null
        : "Enter a 10-digit Indian mobile number";
    default:
      return null;
  }
}

function getRelevantKeys(
  businessType: BusinessTypeValue,
): (keyof CompanyForm)[] {
  return [
    ...BASE_REQUIRED,
    ...getIdentityFields(businessType).map((f) => f.key),
  ];
}

function getRequiredKeys(
  businessType: BusinessTypeValue,
): (keyof CompanyForm)[] {
  return [
    ...BASE_REQUIRED,
    ...getIdentityFields(businessType)
      .filter((f) => f.required)
      .map((f) => f.key),
  ];
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

const fieldBase =
  "rounded-xl border-slate-700 bg-slate-800/50 pl-10 text-white transition-colors placeholder:text-zinc-500 focus-visible:border-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500/30";

function Field({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
  required,
  maxLength,
  type = "text",
  inputMode,
  className,
  disabled,
}: {
  id?: string;
  label: string;
  icon: typeof Hash;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  type?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  className?: string;
  disabled?: boolean;
}) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={className}>
      <Label htmlFor={fieldId} className="text-sm text-zinc-300">
        {label} {required && <span className="text-emerald-400">*</span>}
      </Label>

      <div className="relative mt-1.5">
        <Icon
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
            error ? "text-red-400" : "text-zinc-500",
          )}
        />
        <Input
          id={fieldId}
          type={type}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cn(
            fieldBase,
            error &&
              "border-red-500/60 focus-visible:border-red-500/60 focus-visible:ring-red-500/25",
            disabled && "cursor-not-allowed opacity-60",
          )}
        />
      </div>

      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={`${fieldId}-error`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400"
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {error}
          </motion.p>
        ) : hint ? (
          <p key="hint" className="mt-1.5 text-xs text-zinc-500">
            {hint}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
  highlight,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
  highlight?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={cn("relative", className)}>
      <Label htmlFor={fieldId} className="text-sm text-zinc-300">
        {label} <span className="text-emerald-400">*</span>
      </Label>

      <button
        id={fieldId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className={cn(
          "relative mt-1.5 flex h-10 w-full items-center rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-9 text-left text-sm text-white transition-colors",
          "focus-visible:border-emerald-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
          disabled && "cursor-not-allowed opacity-60",
          highlight && !disabled && "ring-2 ring-emerald-500/40",
        )}
      >
        <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <span className={cn(!value && "text-zinc-500")}>
          {value || "Select business type"}
        </span>
        <ChevronDown
          className={cn(
            "absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl shadow-black/50"
          >
            {options.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt === value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    opt === value
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-zinc-300 hover:bg-slate-800",
                  )}
                >
                  {opt}
                  {opt === value && <Check className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  caption,
}: {
  icon: typeof Hash;
  title: string;
  caption: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
        <Icon className="h-4 w-4 text-emerald-400" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-zinc-500">{caption}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MSIAgreementPage({
  initialStatus = "DRAFT",
  initialData,
  referenceId,
  updatedAt,
  rejectionReason,
  onSubmit,
  onDownload,
  onReturnPolicy,
  showDemoControls = false,
}: MSIAgreementPageProps) {
  const [status, setStatus] = useState<AgreementStatus>(initialStatus);
  const [form, setForm] = useState<CompanyForm>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof CompanyForm, string | null>>
  >({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof CompanyForm, boolean>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [copied, setCopied] = useState(false);

  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const tone = TONES[config.tone];

  const isLocked =
    status === "SUBMITTED" ||
    status === "UNDER_REVIEW" ||
    status === "APPROVED";
  const isApproved = status === "APPROVED";

  const canPickBusinessType = form.companyName.trim().length >= 3;
  const identityFields = useMemo(
    () => getIdentityFields(form.businessType),
    [form.businessType],
  );
  const requiredKeys = useMemo(
    () => getRequiredKeys(form.businessType),
    [form.businessType],
  );

  const completion = useMemo(() => {
    const done = requiredKeys.filter(
      (k) => !validateField(k, form[k] as string, form.businessType),
    ).length;
    return requiredKeys.length
      ? Math.round((done / requiredKeys.length) * 100)
      : 0;
  }, [form, requiredKeys]);

  const currentStep = STATUS_ORDER.indexOf(status);

  const setField = useCallback(
    (key: keyof CompanyForm, raw: string) => {
      const upper: (keyof CompanyForm)[] = [
        "panNumber",
        "gstNumber",
        "cinNumber",
        "udyamNumber",
        "llpinNumber",
      ];
      const digitsOnly: (keyof CompanyForm)[] = ["dinNumber", "contactPhone"];

      let value = raw;
      if (upper.includes(key)) value = raw.toUpperCase();
      if (digitsOnly.includes(key)) value = raw.replace(/\D/g, "");

      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) =>
        touched[key]
          ? { ...prev, [key]: validateField(key, value, form.businessType) }
          : prev,
      );
    },
    [touched, form.businessType],
  );

  const blurField = useCallback(
    (key: keyof CompanyForm) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
      setErrors((prev) => ({
        ...prev,
        [key]: validateField(key, form[key] as string, form.businessType),
      }));
    },
    [form],
  );

  const handleBusinessTypeChange = useCallback((type: BusinessTypeValue) => {
    setForm((prev) => {
      const next = { ...prev, businessType: type };
      DYNAMIC_KEYS.forEach((k) => {
        next[k] = "";
      });
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      DYNAMIC_KEYS.forEach((k) => delete next[k]);
      return next;
    });
    setTouched((prev) => {
      const next = { ...prev };
      DYNAMIC_KEYS.forEach((k) => delete next[k]);
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    const relevantKeys = getRelevantKeys(form.businessType);
    const nextErrors: Partial<Record<keyof CompanyForm, string | null>> = {};
    relevantKeys.forEach((k) => {
      nextErrors[k] = validateField(k, form[k] as string, form.businessType);
    });
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    setTouched((prev) => ({
      ...prev,
      ...relevantKeys.reduce(
        (acc, k) => ({ ...acc, [k]: true }),
        {} as Partial<Record<keyof CompanyForm, boolean>>,
      ),
    }));

    const firstBad = relevantKeys.find((k) => nextErrors[k]);
    if (firstBad) {
      toast.error("Check the highlighted fields before submitting");
      document.getElementById(firstBad)?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.(form);
      setStatus("SUBMITTED");
      toast.success("Agreement submitted for review");
    } catch {
      toast.error("Couldn't submit the agreement. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload?.();
      toast.success("Documentation downloaded");
    } catch {
      toast.error("Download failed. Try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReturnPolicy = async () => {
    setIsReturning(true);
    try {
      await onReturnPolicy?.();
      toast.success("Return policy acknowledged");
    } catch {
      toast.error("Couldn't record the acknowledgement. Try again.");
    } finally {
      setIsReturning(false);
    }
  };

  const copyReference = async () => {
    if (!referenceId) return;
    try {
      await navigator.clipboard.writeText(referenceId);
      setCopied(true);
      toast.success("Reference id copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy. Copy it manually instead.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-950/60 px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5"
      >
        {/* Subtle glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl md:h-56 md:w-56"
        />

        <div className="relative flex items-center gap-3 sm:gap-4">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 shadow-[0_0_20px_-8px_rgba(16,185,129,0.5)] sm:h-11 sm:w-11 md:h-12 md:w-12">
            <ShieldCheck className="h-5 w-5 text-emerald-400 sm:h-5.5 sm:w-5.5 md:h-6 md:w-6" />
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg md:text-xl">
                MSI Agreement
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 sm:px-2.5 sm:text-[10px]">
                <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                Verification
              </span>
            </div>

            {/* Description — hidden on mobile, visible from sm onwards */}
            <p className="mt-1 hidden max-w-2xl text-xs leading-relaxed text-zinc-400 sm:block sm:text-[14  px]">
              Share your registered company details to enable Merchant Service
              Integration on ScanInfoga Commercial verification completes within
              two business days.
            </p>
          </div>
        </div>
        {showDemoControls && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 p-1.5">
            {(Object.keys(STATUS_CONFIG) as AgreementStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs transition-colors",
                  s === status
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-zinc-500 hover:bg-slate-800 hover:text-zinc-300",
                )}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        )}
      </motion.header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---------- Form ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="lg:col-span-2"
        >
          <Card className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur-sm">
            <CardHeader className="gap-4 border-b border-slate-800 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg font-medium text-white">
                  <Building2 className="h-5 w-5 text-emerald-400" />
                  Company details
                </CardTitle>
                <span className="text-xs text-zinc-500">
                  {completion}% complete
                </span>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={false}
                  animate={{ width: `${completion}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-8 pt-6">
              {isLocked && (
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3 text-xs text-zinc-400">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span>
                    These details are locked while your agreement is{" "}
                    {config.label.toLowerCase()}. Contact support to request a
                    change.
                  </span>
                </div>
              )}

              {/* Registration */}
              <section className="space-y-5">
                <SectionTitle icon={FileText} title="Registration" caption="" />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    id="companyName"
                    className="sm:col-span-2"
                    label="Company name"
                    icon={Building2}
                    required
                    disabled={isLocked}
                    value={form.companyName}
                    error={errors.companyName}
                    onChange={(v) => setField("companyName", v)}
                    onBlur={() => blurField("companyName")}
                    placeholder="Example Enterprises Private Limited"
                  />

                  <SelectField
                    id="businessType"
                    className="sm:col-span-2"
                    label="Business type"
                    value={form.businessType}
                    options={BUSINESS_TYPES}
                    disabled={isLocked || !canPickBusinessType}
                    highlight={canPickBusinessType && !form.businessType}
                    hint={
                      !canPickBusinessType
                        ? "Enter your registered company name first"
                        : !form.businessType
                          ? "We'll show the exact registration numbers we need based on this"
                          : undefined
                    }
                    onChange={(v) =>
                      handleBusinessTypeChange(v as BusinessTypeValue)
                    }
                  />
                </div>
              </section>

              {/* Identity — dynamic, based on business type */}
              <section className="space-y-5 border-t border-slate-800 pt-8">
                <SectionTitle
                  icon={Layers}
                  title="Registration identity"
                  caption="Fields adapt automatically to your business type"
                />

                <AnimatePresence mode="wait">
                  {!form.businessType ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-4 text-xs text-zinc-500"
                    >
                      <Info className="h-4 w-4 shrink-0" />
                      Select a business type above to see the exact registration
                      numbers we need.
                    </motion.div>
                  ) : (
                    <motion.div
                      key={form.businessType}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-relaxed text-emerald-300/90">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {getIdentityDescription(form.businessType)}
                      </div>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {identityFields.map(({ key, required }) => {
                          const meta = FIELD_META[key];
                          return (
                            <Field
                              key={key}
                              id={key}
                              className={
                                meta.fullWidth ? "sm:col-span-2" : undefined
                              }
                              label={meta.label(form.businessType)}
                              icon={meta.icon}
                              required={required}
                              disabled={isLocked}
                              maxLength={meta.maxLength}
                              inputMode={meta.inputMode}
                              value={form[key]}
                              error={errors[key]}
                              hint={meta.hint}
                              onChange={(v) => setField(key, v)}
                              onBlur={() => blurField(key)}
                              placeholder={meta.placeholder}
                            />
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Address */}
              <section className="space-y-5 border-t border-slate-800 pt-8">
                <SectionTitle
                  icon={MapPin}
                  title="Registered address"
                  caption="As it appears on your registration documents"
                />
                <Field
                  id="registeredAddress"
                  label="Registered address"
                  icon={MapPin}
                  required
                  disabled={isLocked}
                  value={form.registeredAddress}
                  error={errors.registeredAddress}
                  onChange={(v) => setField("registeredAddress", v)}
                  onBlur={() => blurField("registeredAddress")}
                  placeholder="123 Sample Street, New Delhi, 110001"
                />
              </section>

              {/* Contact */}
              <section className="space-y-5 border-t border-slate-800 pt-8">
                <SectionTitle
                  icon={User}
                  title="Point of contact"
                  caption="Who we reach out to about this agreement"
                />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    id="contactPerson"
                    label="Contact person"
                    icon={User}
                    required
                    disabled={isLocked}
                    value={form.contactPerson}
                    error={errors.contactPerson}
                    onChange={(v) => setField("contactPerson", v)}
                    onBlur={() => blurField("contactPerson")}
                    placeholder="Full name"
                  />

                  <Field
                    id="contactEmail"
                    label="Contact email"
                    icon={Mail}
                    type="email"
                    inputMode="email"
                    required
                    disabled={isLocked}
                    value={form.contactEmail}
                    error={errors.contactEmail}
                    onChange={(v) => setField("contactEmail", v)}
                    onBlur={() => blurField("contactEmail")}
                    placeholder="contact@company.com"
                  />

                  <Field
                    id="contactPhone"
                    className="sm:col-span-2"
                    label="Contact phone"
                    icon={Phone}
                    inputMode="tel"
                    required
                    disabled={isLocked}
                    maxLength={10}
                    value={form.contactPhone}
                    error={errors.contactPhone}
                    onChange={(v) => setField("contactPhone", v)}
                    onBlur={() => blurField("contactPhone")}
                    placeholder="9812345670"
                  />
                </div>
              </section>

              {/* Use case */}
              <section className="space-y-5 border-t border-slate-800 pt-8">
                <SectionTitle
                  icon={Briefcase}
                  title="How you'll use MSI"
                  caption="A short summary helps compliance move faster"
                />

                <div>
                  <Label htmlFor="use-case" className="text-sm text-zinc-300">
                    Use case
                  </Label>
                  <textarea
                    id="use-case"
                    rows={4}
                    disabled={isLocked}
                    maxLength={600}
                    value={form.useCase}
                    onChange={(e) => setField("useCase", e.target.value)}
                    placeholder="e.g. KYC verification during customer onboarding for our lending product."
                    className={cn(
                      "mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-sm leading-relaxed text-white transition-colors placeholder:text-zinc-500",
                      "focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
                      isLocked && "cursor-not-allowed opacity-60",
                    )}
                  />
                  <p className="mt-1.5 text-right text-xs text-zinc-500">
                    {form.useCase.length}/600
                  </p>
                </div>
              </section>

              {/* Submit */}
              <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-zinc-500">
                  Submitting confirms these details match your official
                  registration records.
                </p>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || isLocked}
                  className="w-full shrink-0 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 transition-colors hover:bg-emerald-500 disabled:opacity-60 sm:w-auto"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {isApproved
                    ? "Approved"
                    : isLocked
                      ? "Awaiting review"
                      : isSubmitting
                        ? "Submitting"
                        : "Submit agreement"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ---------- Sidebar ---------- */}
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
          className="space-y-4 lg:sticky lg:top-6 lg:self-start"
        >
          {/* Status */}
          <Card className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-white">
                Status
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={status}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4",
                    tone.border,
                    tone.bg,
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1",
                      tone.bg,
                      tone.ring,
                    )}
                  >
                    <StatusIcon className={cn("h-5 w-5", tone.text)} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-semibold", tone.text)}>
                      {config.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {config.description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {(referenceId || updatedAt) && (
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  {referenceId && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-500">Reference</span>
                      <button
                        type="button"
                        onClick={copyReference}
                        className="flex items-center gap-1.5 font-mono text-xs text-zinc-300 transition-colors hover:text-emerald-400"
                      >
                        {referenceId}
                        {copied ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}
                  {updatedAt && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-500">
                        Last updated
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                        <Calendar className="h-3 w-3 text-zinc-500" />
                        {new Date(updatedAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              <ol className="space-y-0 border-t border-slate-800 pt-4">
                {TIMELINE.map((step, idx) => {
                  const rejected = status === "REJECTED";
                  const isDone = !rejected && currentStep >= idx;
                  const isCurrent = status === step.key;
                  const isLast = idx === TIMELINE.length - 1;

                  return (
                    <li key={step.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors",
                            isDone
                              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                              : rejected && idx === 0
                                ? "border-red-500/50 bg-red-500/20 text-red-400"
                                : "border-slate-700 bg-slate-800 text-zinc-500",
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        {!isLast && (
                          <div
                            className={cn(
                              "my-1 w-px flex-1 transition-colors",
                              currentStep > idx && !rejected
                                ? "bg-emerald-500/40"
                                : "bg-slate-800",
                            )}
                          />
                        )}
                      </div>

                      <div className={cn("pb-4", isLast && "pb-0")}>
                        <p
                          className={cn(
                            "text-xs",
                            isCurrent
                              ? "font-semibold text-white"
                              : isDone
                                ? "text-emerald-400"
                                : "text-zinc-500",
                          )}
                        >
                          {step.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-600">
                          {step.hint}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-white">
                Actions
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <Button
                onClick={handleDownload}
                disabled={isDownloading || !isApproved}
                variant="outline"
                className="w-full justify-start rounded-xl border-slate-700 bg-slate-800/40 text-zinc-200 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download documentation
              </Button>

              <AnimatePresence initial={false}>
                {isApproved && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <Button
                      onClick={handleReturnPolicy}
                      disabled={isReturning}
                      variant="outline"
                      className="w-full justify-start rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-400 transition-colors hover:border-amber-500/60 hover:bg-amber-500/20 hover:text-amber-300"
                    >
                      {isReturning ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      Return policy
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {!isApproved && (
                <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs leading-relaxed text-zinc-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Downloads and the return policy unlock once your agreement
                    is approved.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rejection */}
          <AnimatePresence>
            {status === "REJECTED" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex items-start gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs leading-relaxed text-red-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-2">
                  <p>
                    {rejectionReason ??
                      "The details didn't match official records."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus("DRAFT")}
                    className="font-medium text-red-200 underline underline-offset-2 transition-colors hover:text-white"
                  >
                    Edit and resubmit
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
      </div>
    </div>
  );
}
