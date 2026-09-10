'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Cake,
  CalendarCheck,
  CalendarDays,
  Fingerprint,
  FileText,
  Globe2,
  Hash,
  History,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InfoText2 from '@/components/custom/components/InfoText2';
import VerifiedBadge from '@/components/common/VerifiedBadge';
import {
  calculateAge,
  expandGender,
  expandYesNo,
  formatDateOfBirth,
  formatDateTime,
  formatSentence,
} from '@/components/custom/functions/formatUtils';
import { cn } from '@/lib/utils';
import type {
  AadhaarAuthenticationHistory,
  AadhaarKycData,
  AadhaarUpdateHistory,
} from '@/types/kyc';

interface AadhaarKycTabsProps {
  data: AadhaarKycData;
  /** Where the KYC was performed, reverse-geocoded by the backend. */
  kycAddress?: string | null;
  verifiedAt?: string | null;
  lastUpdatedAt?: string | null;
}

const TAB_TRIGGER =
  'flex items-center justify-center gap-1.5 rounded-xl border-0 px-2 py-2 text-[11px] font-semibold text-slate-400 transition-all duration-300 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 sm:gap-2 sm:px-4 sm:text-sm';

function SectionHeader({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-emerald-400">{icon}</span>
      <h4 className="text-sm font-semibold text-white">{children}</h4>
      <div className="h-px flex-1 bg-slate-800" />
    </div>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-xl sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Header strip: UIDAI photo, name, Aadhaar number and verification stamps. */
function IdentityStrip({
  data,
  kycAddress,
  verifiedAt,
  lastUpdatedAt,
}: AadhaarKycTabsProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4 text-center sm:flex-row sm:text-left">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-emerald-500/40 bg-slate-950 ring-2 ring-emerald-500/10">
        {data.profile_image ? (
          <Image
            src={data.profile_image}
            alt={data.name || 'Aadhaar photo'}
            fill
            unoptimized
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UserCircle2 className="h-9 w-9 text-slate-600" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-center gap-1.5 sm:justify-start">
          <h3 className="break-words text-lg font-bold text-white">
            {formatSentence(data.name)}
          </h3>
          <VerifiedBadge title="Aadhaar verified with UIDAI" size={16} />
        </div>
        <p className="mt-1 break-all font-mono text-sm text-emerald-400">
          {formatSentence(data.aadhaar_number)}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-400">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            Verified {formatDateTime(verifiedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-400">
            <CalendarCheck className="h-3 w-3 text-cyan-400" />
            Updated {formatDateTime(lastUpdatedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 break-words rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-400">
            <MapPin className="h-3 w-3" />
            <span className="font-semibold uppercase tracking-wide text-amber-400/70">
              KYC Address
            </span>
            {formatSentence(kycAddress)}
          </span>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  data,
  kycAddress,
  verifiedAt,
  lastUpdatedAt,
}: AadhaarKycTabsProps) {
  const age = calculateAge(data.date_of_birth);

  return (
    <div className="space-y-4">
      <IdentityStrip
        data={data}
        kycAddress={kycAddress}
        verifiedAt={verifiedAt}
        lastUpdatedAt={lastUpdatedAt}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionHeader icon={<UserCircle2 className="h-4 w-4" />}>
            Personal Info
          </SectionHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoText2
              label="Name"
              value={formatSentence(data.name)}
              icon={<UserCircle2 className="h-4 w-4" />}
              valueClassName="break-words font-semibold text-emerald-400"
            />
            <InfoText2
              label="Gender"
              value={formatSentence(expandGender(data.gender))}
              icon={<UserCircle2 className="h-4 w-4" />}
              valueClassName="text-white"
            />
            <InfoText2
              label="Date of Birth"
              value={formatSentence(formatDateOfBirth(data.date_of_birth))}
              icon={<Cake className="h-4 w-4" />}
              valueClassName="font-semibold text-cyan-400"
            />
            <InfoText2
              label="Age"
              value={formatSentence(age === null ? null : `${age} Years`)}
              icon={<CalendarDays className="h-4 w-4" />}
              valueClassName="text-white"
            />
            <InfoText2
              label="Care Of"
              value={formatSentence(data.care_of)}
              icon={<UserCircle2 className="h-4 w-4" />}
              valueClassName="break-words text-white"
            />
          </div>
        </Card>

        <Card>
          <SectionHeader icon={<FileText className="h-4 w-4" />}>
            Documents
          </SectionHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoText2
              label="Aadhaar Number"
              value={formatSentence(data.aadhaar_number)}
              icon={<Fingerprint className="h-4 w-4" />}
              valueClassName="break-all font-mono text-white"
            />
            <InfoText2
              label="VID"
              value={formatSentence(data.vid)}
              icon={<Hash className="h-4 w-4" />}
              valueClassName="break-all font-mono text-white"
            />
            <InfoText2
              label="EID"
              value={formatSentence(data.eid)}
              icon={<Hash className="h-4 w-4" />}
              valueClassName="break-all font-mono text-white"
            />
            <InfoText2
              label="Biometric Enabled"
              value={formatSentence(expandYesNo(data.is_biometric_enabled))}
              icon={<BadgeCheck className="h-4 w-4" />}
              valueClassName="text-white"
            />
          </div>
        </Card>

        <Card>
          <SectionHeader icon={<Phone className="h-4 w-4" />}>
            Contact
          </SectionHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoText2
              label="Mobile"
              value={formatSentence(data.mobile_number)}
              icon={<Phone className="h-4 w-4" />}
              valueClassName="font-semibold text-violet-400"
            />
            <InfoText2
              label="Email"
              value={formatSentence(data.email)}
              icon={<Mail className="h-4 w-4" />}
              valueClassName="break-all text-white"
            />
          </div>
        </Card>

        <Card>
          <SectionHeader icon={<MapPin className="h-4 w-4" />}>
            Address
          </SectionHeader>
          <div className="space-y-3">
            <InfoText2
              label="Full Address"
              value={formatSentence(data.address)}
              icon={<MapPin className="h-4 w-4" />}
              valueClassName="break-words font-semibold text-amber-400"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoText2
                label="Post Office"
                value={formatSentence(data.post_office)}
                icon={<MapPin className="h-4 w-4" />}
                valueClassName="break-words text-white"
              />
              <InfoText2
                label="Sub District"
                value={formatSentence(data.sub_district)}
                icon={<MapPin className="h-4 w-4" />}
                valueClassName="break-words text-white"
              />
              <InfoText2
                label="District"
                value={formatSentence(data.district)}
                icon={<MapPin className="h-4 w-4" />}
                valueClassName="break-words text-white"
              />
              <InfoText2
                label="State"
                value={formatSentence(data.state)}
                icon={<Globe2 className="h-4 w-4" />}
                valueClassName="text-white"
              />
              <InfoText2
                label="Pincode"
                value={formatSentence(data.pincode)}
                icon={<Hash className="h-4 w-4" />}
                valueClassName="font-mono text-white"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BankSeedingTab({ data }: { data: AadhaarKycData }) {
  const seeding = data.bank_seeding_status;
  const active =
    String(seeding?.bank_seeding_status || '').toLowerCase() === 'active';

  return (
    <Card>
      <SectionHeader icon={<Landmark className="h-4 w-4" />}>
        Bank Seeding Status
      </SectionHeader>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
              active
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-700 bg-slate-800/60 text-slate-400',
            )}
          >
            <Landmark className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="break-words text-base font-bold text-white">
              {formatSentence(seeding?.bank_name, true)}
            </p>
            <p className="text-xs text-slate-500">Seeded bank account</p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold',
            active
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/40 bg-red-500/10 text-red-400',
          )}
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          {formatSentence(seeding?.bank_seeding_status)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <InfoText2
          label="Aadhaar Number"
          value={formatSentence(seeding?.aadhaar_number)}
          icon={<Fingerprint className="h-4 w-4" />}
          valueClassName="break-all font-mono text-white"
        />
        <InfoText2
          label="Bank Name"
          value={formatSentence(seeding?.bank_name, true)}
          icon={<Landmark className="h-4 w-4" />}
          valueClassName="break-words text-white"
        />
        <InfoText2
          label="Last Updated"
          value={formatSentence(seeding?.last_updated_date)}
          icon={<CalendarDays className="h-4 w-4" />}
          valueClassName="text-white"
        />
      </div>
    </Card>
  );
}

function UpdateHistoryCard({
  entry,
  index,
}: {
  entry: AadhaarUpdateHistory;
  index: number;
}) {
  const isEnrolment = /new enrolment/i.test(entry.update_type || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl transition-colors duration-300 hover:border-emerald-500/40"
    >
      <div
        className={cn(
          'h-1 w-full',
          isEnrolment ? 'bg-cyan-500/60' : 'bg-emerald-500/60',
        )}
      />
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <div className="relative h-24 w-20 shrink-0 self-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950 sm:self-start">
          {entry.profile_image ? (
            <Image
              src={entry.profile_image}
              alt={entry.name || 'Aadhaar update photo'}
              fill
              unoptimized
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UserCircle2 className="h-8 w-8 text-slate-600" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold',
                isEnrolment
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
              )}
            >
              <History className="h-3 w-3" />
              {formatSentence(entry.update_type)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-400">
              <CalendarDays className="h-3 w-3" />
              {formatSentence(entry.date_of_enrolment_update)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoText2
              label="Name"
              value={formatSentence(entry.name)}
              icon={<UserCircle2 className="h-4 w-4" />}
              valueClassName="break-words text-white"
            />
            <InfoText2
              label="Gender"
              value={formatSentence(expandGender(entry.gender))}
              icon={<UserCircle2 className="h-4 w-4" />}
              valueClassName="text-white"
            />
            <InfoText2
              label="Date of Birth"
              value={formatSentence(formatDateOfBirth(entry.date_of_birth))}
              icon={<Cake className="h-4 w-4" />}
              valueClassName="text-cyan-400"
            />
            <InfoText2
              label="Mobile"
              value={formatSentence(entry.mobile_number)}
              icon={<Phone className="h-4 w-4" />}
              valueClassName="break-all font-mono text-white"
            />
            <InfoText2
              label="Email"
              value={formatSentence(entry.email)}
              icon={<Mail className="h-4 w-4" />}
              valueClassName="break-all text-white"
            />
            <InfoText2
              label="URN / EID"
              value={formatSentence(entry.urn_eid)}
              icon={<Hash className="h-4 w-4" />}
              valueClassName="break-all font-mono text-white"
            />
          </div>

          <InfoText2
            label="Address"
            value={formatSentence(entry.address)}
            icon={<MapPin className="h-4 w-4" />}
            valueClassName="break-words text-amber-400"
          />
        </div>
      </div>
    </motion.div>
  );
}

function UpdateHistoryTab({ data }: { data: AadhaarKycData }) {
  const history = data.aadhaar_update_history ?? [];

  if (history.length === 0) {
    return <EmptyState label="No Aadhaar update history available" />;
  }

  return (
    <div className="scrollbar-custom max-h-[60vh] space-y-3 overflow-y-auto pr-1">
      {history.map((entry, i) => (
        <UpdateHistoryCard
          key={`${entry.urn_eid}-${i}`}
          entry={entry}
          index={i}
        />
      ))}
    </div>
  );
}

function AuthHistoryRow({
  entry,
  index,
}: {
  entry: AadhaarAuthenticationHistory;
  index: number;
}) {
  const success = /success/i.test(entry.status || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 12) * 0.02 }}
      className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors duration-300 hover:border-emerald-500/40"
    >
      <div
        className={cn(
          'w-1 shrink-0 rounded-xl',
          success ? 'bg-emerald-500/70' : 'bg-red-500/70',
        )}
      />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold',
              success
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/40 bg-red-500/10 text-red-400',
            )}
          >
            <BadgeCheck className="h-3 w-3" />
            {formatSentence(entry.status)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-400">
            <CalendarDays className="h-3 w-3" />
            {formatSentence(formatDateOfBirth(entry.date))} ·{' '}
            {formatSentence(entry.time)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoText2
            label="Authority (AUA)"
            value={formatSentence(entry.aua_name)}
            icon={<Landmark className="h-4 w-4" />}
            valueClassName="break-words text-white"
          />
          <InfoText2
            label="Modality"
            value={formatSentence(entry.modality, true)}
            icon={<Fingerprint className="h-4 w-4" />}
            valueClassName="text-white"
          />
          <InfoText2
            label="Error Code"
            value={formatSentence(entry.error_code)}
            icon={<Hash className="h-4 w-4" />}
            valueClassName={cn(
              'font-mono',
              success ? 'text-white' : 'text-red-400',
            )}
          />
          <InfoText2
            label="Response Code"
            value={formatSentence(entry.response_code)}
            icon={<Hash className="h-4 w-4" />}
            valueClassName="break-all font-mono text-white"
          />
        </div>

        <InfoText2
          label="Transaction ID"
          value={formatSentence(entry.transaction_id)}
          icon={<Hash className="h-4 w-4" />}
          valueClassName="break-all font-mono text-slate-300"
        />
      </div>
    </motion.div>
  );
}

function AuthHistoryTab({ data }: { data: AadhaarKycData }) {
  const history = data.authentication_history ?? [];

  if (history.length === 0) {
    return <EmptyState label="No authentication history available" />;
  }

  const success = history.filter((e) => /success/i.test(e.status || '')).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Total" value={history.length} accent="text-white" />
        <StatTile label="Success" value={success} accent="text-emerald-400" />
        <StatTile
          label="Failure"
          value={history.length - success}
          accent="text-red-400"
        />
      </div>
      <div className="scrollbar-custom max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {history.map((entry, i) => (
          <AuthHistoryRow
            key={`${entry.transaction_id}-${i}`}
            entry={entry}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={cn('text-lg font-bold', accent)}>{value}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 py-14">
      <History className="h-8 w-8 text-slate-600" />
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

/**
 * The verified Aadhaar record split into four tabs — Overview, Bank Seeding,
 * Update History and Authentication History.
 */
export default function AadhaarKycTabs({
  data,
  kycAddress,
  verifiedAt,
  lastUpdatedAt,
}: AadhaarKycTabsProps): JSX.Element {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1 sm:grid-cols-4 sm:gap-2">
        <TabsTrigger value="overview" className={TAB_TRIGGER}>
          <UserCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="seeding" className={TAB_TRIGGER}>
          <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Bank Seeding
        </TabsTrigger>
        <TabsTrigger value="updates" className={TAB_TRIGGER}>
          <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Update History
        </TabsTrigger>
        <TabsTrigger value="auth" className={TAB_TRIGGER}>
          <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Auth History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-0">
        <OverviewTab
          data={data}
          kycAddress={kycAddress}
          verifiedAt={verifiedAt}
          lastUpdatedAt={lastUpdatedAt}
        />
      </TabsContent>
      <TabsContent value="seeding" className="mt-0">
        <BankSeedingTab data={data} />
      </TabsContent>
      <TabsContent value="updates" className="mt-0">
        <UpdateHistoryTab data={data} />
      </TabsContent>
      <TabsContent value="auth" className="mt-0">
        <AuthHistoryTab data={data} />
      </TabsContent>
    </Tabs>
  );
}
