'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { BadgeCheck, PartyPopper, Sparkles, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RootState } from '@/redux/store';

interface KycCompletedDialogProps {
  open: boolean;
  /**
   * The frame the liveness worker captured and recorded on the account,
   * handed over on the redirect. Falls back to the stored photos when the
   * worker could not upload one.
   */
  profileImage: string | null;
  onClose: () => void;
}

/**
 * Shown once, on the way back from a passed video KYC. Unlike the gate
 * dialogs this one IS dismissable — nothing is blocked any more, it just
 * confirms the account is fully verified.
 */
export default function KycCompletedDialog({
  open,
  profileImage,
  onClose,
}: KycCompletedDialogProps): JSX.Element {
  const user = useSelector((state: RootState) => state.user.user);
  const photo = profileImage || user?.profile_image || user?.aadhaar_image;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <PartyPopper className="h-7 w-7" />
          </div>
          <DialogTitle className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-xl font-bold text-transparent md:text-2xl">
            Congratulations, your KYC is completed
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            Your face has been verified against your Aadhaar photo.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center space-y-5 text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-xl" />
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-emerald-500/50 bg-slate-950 ring-4 ring-emerald-500/10">
              {photo ? (
                <Image
                  src={photo}
                  alt={user?.name || 'Verified user'}
                  fill
                  unoptimized
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <UserCircle2 className="h-12 w-12 text-slate-600" />
                </div>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-emerald-500">
              <BadgeCheck className="h-4 w-4 text-black" />
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="text-sm text-emerald-300">
              You can now use the advanced features
            </span>
          </div>

          <p className="break-words text-sm text-slate-400">
            Digital Intelligence and Scaninfoga 365 Intelligence are unlocked on
            your account.
          </p>

          <Button
            type="button"
            onClick={onClose}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
          >
            Start exploring
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
