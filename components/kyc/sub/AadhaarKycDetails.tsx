'use client';

import {
  BadgeCheck,
  Cake,
  CalendarDays,
  Fingerprint,
  Globe2,
  Hash,
  Landmark,
  Mail,
  MapPin,
  Phone,
  UserCircle2,
} from 'lucide-react';
import InfoText2 from '@/components/custom/components/InfoText2';
import {
  expandGender,
  formatDateOfBirth,
  formatSentence,
} from '@/components/custom/functions/formatUtils';
import { cn } from '@/lib/utils';
import type { AadhaarKycData } from '@/types/kyc';

interface AadhaarKycDetailsProps {
  data: AadhaarKycData;
}

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
        'rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Semantic breakdown of the verified Aadhaar record — personal info,
 * documents, contact, address and bank seeding status.
 */
export default function AadhaarKycDetails({
  data,
}: AadhaarKycDetailsProps): JSX.Element {
  const seeding = data.bank_seeding_status;
  const seedingActive =
    String(seeding?.bank_seeding_status || '').toLowerCase() === 'active';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <SectionHeader icon={<UserCircle2 className="h-4 w-4" />}>
          Personal Info
        </SectionHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoText2
            label="Name"
            value={formatSentence(data.name)}
            icon={<UserCircle2 className="h-4 w-4 text-emerald-400" />}
            valueClassName="break-words text-base font-semibold text-emerald-400"
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
            icon={<Cake className="h-4 w-4 text-cyan-400" />}
            valueClassName="text-base font-semibold text-cyan-400"
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
        <SectionHeader icon={<Fingerprint className="h-4 w-4" />}>
          Documents
        </SectionHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoText2
            label="Aadhaar"
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
            value={formatSentence(data.is_biometric_enabled)}
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
            icon={<Phone className="h-4 w-4 text-violet-400" />}
            valueClassName="text-base font-semibold text-violet-400"
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
            icon={<MapPin className="h-4 w-4 text-amber-400" />}
            valueClassName="break-words text-base font-semibold text-amber-400"
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

      <Card className="md:col-span-2">
        <SectionHeader icon={<Landmark className="h-4 w-4" />}>
          Bank Seeding Status
        </SectionHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoText2
            label="Bank Name"
            value={formatSentence(seeding?.bank_name)}
            icon={<Landmark className="h-4 w-4" />}
            valueClassName="break-words text-white"
          />
          <InfoText2
            label="Seeding Status"
            value={formatSentence(seeding?.bank_seeding_status)}
            icon={<BadgeCheck className="h-4 w-4" />}
            valueClassName={cn(
              'text-white',
              seedingActive && 'text-emerald-400',
              seeding && !seedingActive && 'text-red-400',
            )}
          />
          <InfoText2
            label="Last Updated"
            value={formatSentence(seeding?.last_updated_date)}
            icon={<CalendarDays className="h-4 w-4" />}
            valueClassName="text-white"
          />
        </div>
      </Card>
    </div>
  );
}
