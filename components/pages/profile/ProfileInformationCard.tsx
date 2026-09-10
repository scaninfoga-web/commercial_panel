'use client';

import Image from 'next/image';
import {
  User as UserIcon,
  Mail,
  Crown,
  Smile,
  Meh,
  Frown,
  Cake,
  CalendarDays,
  Fingerprint,
  Wallet,
  Phone,
  UserCircle2,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import VerifiedBadge from '@/components/common/VerifiedBadge';
import {
  calculateAge,
  formatDateOfBirth,
  formatSentence,
} from '@/components/custom/functions/formatUtils';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import KycDocumentsRow from './sub/KycDocumentsRow';

const ROW_CLASS =
  'group flex flex-col gap-2 rounded-xl border border-slate-800/50 bg-slate-900/30 px-3 py-2.5 transition-all duration-300 hover:border-emerald-500/30 hover:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3';

const InfoRow = ({
  icon: Icon,
  label,
  value,
  valueColor,
  customValue,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | number;
  valueColor?: string;
  customValue?: React.ReactNode;
}) => (
  <div className={ROW_CLASS}>
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 sm:h-8 sm:w-8">
        <Icon className="h-3.5 w-3.5 text-slate-400 sm:h-4 sm:w-4" />
      </div>
      <span className="text-xs text-slate-400 sm:text-sm">{label}</span>
    </div>
    {customValue || (
      <span
        className={cn(
          'break-words text-sm font-medium sm:text-base',
          valueColor || 'text-white',
        )}
      >
        {value}
      </span>
    )}
  </div>
);

/** Small labelled photo tile — profile avatar / UIDAI Aadhaar photo. */
const PhotoTile = ({
  src,
  label,
  alt,
}: {
  src: string | null | undefined;
  label: string;
  alt: string;
}) => (
  <div className="flex flex-col items-center gap-1">
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 ring-1 ring-emerald-400/20 sm:h-16 sm:w-16">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="64px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <UserCircle2 className="h-7 w-7 text-slate-500" />
        </div>
      )}
    </div>
    <span className="text-[10px] uppercase tracking-wide text-slate-500">
      {label}
    </span>
  </div>
);

export const ProfileInformationCard = () => {
  const user = useSelector((state: RootState) => state.user.user);
  const walletBalance = useSelector((state: RootState) => state.wallet.balance);

  const kycVerified = Boolean(user?.is_aadhaar_kyc);
  const age = calculateAge(user?.date_of_birth);

  const getTierColor = (tier?: string) => {
    switch (tier?.toUpperCase()) {
      case 'ADMIN':
        return 'bg-gradient-to-r from-emerald-400 to-emerald-600 text-white border-emerald-300';
      case 'COMMERCIAL':
        return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-amber-900 border-amber-300';
      case 'COOPERATIVE':
        return 'bg-gradient-to-r from-blue-400 to-blue-500 text-white border-blue-300';
      case 'COOPERATIVE_MEMBER':
        return 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-400';
      default:
        return 'bg-gradient-to-r from-slate-400 to-slate-500 text-slate-900 border-slate-300';
    }
  };

  const getWalletIcon = (balance: number) => {
    if (balance < 10000) return <Frown className="h-5 w-5 text-red-400" />;
    if (balance <= 30000) return <Meh className="h-5 w-5 text-yellow-400" />;
    return <Smile className="h-5 w-5 text-emerald-400" />;
  };

  const getWalletStatusColor = (balance: number) => {
    if (balance < 10000) return 'text-red-400';
    if (balance <= 30000) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  return (
    <Card className="h-full rounded-xl border-slate-800 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
        <CardTitle className="flex items-center gap-2 text-sm text-emerald-400 sm:text-base">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 sm:h-8 sm:w-8">
            <UserIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 sm:space-y-5 sm:px-6 sm:pb-6">
        {/* Profile Header — profile photo, Aadhaar photo, identity */}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-3 text-center sm:flex-row sm:gap-4 sm:p-4 sm:text-left">
          <motion.div
            className="flex shrink-0 items-start gap-3"
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <PhotoTile
              src={user?.profile_image}
              label="Profile"
              alt={`${user?.name || 'User'} profile photo`}
            />
            <PhotoTile
              src={user?.aadhaar_image}
              label="Aadhaar"
              alt={`${user?.name || 'User'} Aadhaar photo`}
            />
          </motion.div>

          <div className="min-w-0 flex-1">
            <h3 className="flex items-center justify-center gap-1.5 text-base font-semibold text-white sm:justify-start sm:text-lg">
              <span className="break-words">{formatSentence(user?.name)}</span>
              {kycVerified && (
                <VerifiedBadge title="Aadhaar KYC verified" size={16} />
              )}
            </h3>
            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 sm:justify-start sm:text-sm">
              <Mail className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
              <span className="break-all">{user?.email}</span>
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="space-y-2">
          {/* Date of Birth + Age */}
          <div className={ROW_CLASS}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 sm:h-8 sm:w-8">
                <Cake className="h-3.5 w-3.5 text-cyan-400 sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs text-slate-400 sm:text-sm">
                Date of Birth
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-white sm:text-base">
                {formatSentence(formatDateOfBirth(user?.date_of_birth))}
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[11px] font-medium text-cyan-400">
                <CalendarDays className="h-3 w-3" />
                {formatSentence(age === null ? null : `${age} Years`)}
              </span>
            </div>
          </div>

          {/* Phone — registered + Aadhaar-linked, always both */}
          <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 px-3 py-2.5 transition-all duration-300 hover:border-emerald-500/30 hover:bg-slate-800/50 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 sm:h-8 sm:w-8">
                <Phone className="h-3.5 w-3.5 text-slate-400 sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs text-slate-400 sm:text-sm">Phone</span>
            </div>

            <div className="mt-2.5 space-y-2">
              <div className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-950/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 sm:text-xs">
                  <Phone className="h-3 w-3 text-emerald-400" />
                  Registered Mobile
                </span>
                <span className="flex items-center gap-1.5 break-all font-mono text-sm font-medium text-white">
                  {formatSentence(user?.mobile_number)}
                  <VerifiedBadge title="Registered mobile verified" size={13} />
                </span>
              </div>

              <div className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-950/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 sm:text-xs">
                  <Fingerprint className="h-3 w-3 text-emerald-400" />
                  Aadhaar Mobile
                </span>
                <span className="flex items-center gap-1.5 break-all font-mono text-sm font-medium text-white">
                  {formatSentence(user?.aadhaar_mobile_number)}
                  {kycVerified && (
                    <VerifiedBadge title="Verified with UIDAI" size={13} />
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Wallet Balance */}
          <InfoRow
            icon={Wallet}
            label="Wallet Balance"
            customValue={
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm font-bold sm:text-base',
                    getWalletStatusColor(walletBalance || 0),
                  )}
                >
                  {(walletBalance || 0).toLocaleString()}
                </span>
                {getWalletIcon(walletBalance || 0)}
              </div>
            }
          />

          {/* Tier Badge */}
          <div className={ROW_CLASS}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 sm:h-8 sm:w-8">
                <Crown className="h-3.5 w-3.5 text-amber-400 sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs text-slate-400 sm:text-sm">Tier</span>
            </div>
            <Badge
              className={cn(
                getTierColor(user?.tier),
                'flex w-fit items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-bold shadow-lg sm:px-3 sm:py-1.5 sm:text-xs',
              )}
            >
              <Crown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="uppercase tracking-wide">
                {user?.tier || 'NORMAL'}
              </span>
            </Badge>
          </div>

          {/* KYC Documents — only once Aadhaar KYC is complete */}
          {kycVerified && <KycDocumentsRow />}
        </div>
      </CardContent>
    </Card>
  );
};
