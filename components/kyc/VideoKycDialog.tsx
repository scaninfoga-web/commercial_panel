'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  ScanFace,
  ShieldCheck,
  Sun,
  UserCircle2,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createVideoKycSession,
  extractVideoKycError,
  videoKycReturnUrl,
} from '@/lib/videoKyc';
import { cn } from '@/lib/utils';
import type { RootState } from '@/redux/store';

interface VideoKycDialogProps {
  open: boolean;
  greeting: string;
  /** Leaves for an ungated route — the only way out without verifying. */
  onLeave: () => void;
}

const REQUIREMENTS = [
  { icon: Camera, label: 'Allow camera access when prompted' },
  { icon: Sun, label: 'Sit in a well-lit place, face uncovered' },
  { icon: ScanFace, label: 'Follow the on-screen head movements' },
] as const;

/**
 * Second and final KYC stage: a face-match + liveness capture run by the
 * `face_liveness_service` worker.
 *
 * The capture itself does not happen here. This dialog creates a handoff
 * session on the worker — sending the user's bearer token, the `clientInfo`
 * header and the UIDAI Aadhaar photo URL — and redirects to the opaque link it
 * returns. Nothing sensitive rides in that URL, and the worker sends the user
 * straight back here once the main backend has recorded the pass.
 */
export default function VideoKycDialog({
  open,
  greeting,
  onLeave,
}: VideoKycDialogProps): JSX.Element {
  const pathname = usePathname();
  const user = useSelector((state: RootState) => state.user.user);
  const [loading, setLoading] = useState(false);

  // The face match needs the UIDAI photo Aadhaar KYC produced. Without it the
  // worker has no reference to compare the live capture against.
  const aadhaarImage = user?.aadhaar_image || null;

  const start = useCallback(async () => {
    if (!aadhaarImage) return;
    setLoading(true);
    try {
      const session = await createVideoKycSession({
        aadhaarImageUrl: aadhaarImage,
        profileImageUrl: user?.profile_image || aadhaarImage,
        returnUrl: videoKycReturnUrl(pathname || '/dashboard'),
      });
      // Full navigation on purpose — the capture lives on the worker's own
      // origin, and the user is sent back here when it is recorded.
      window.location.href = session.verify_url;
    } catch (err) {
      toast.error(
        extractVideoKycError(err, 'Could not start video KYC. Please retry.'),
      );
      setLoading(false);
    }
  }, [aadhaarImage, user?.profile_image, pathname]);

  return (
    // Mandatory flow: `onOpenChange` is intentionally absent, so Escape, an
    // outside click or the close button can never dismiss the gate.
    <Dialog open={open}>
      <DialogContent
        className={cn(
          // `[&>button]:hidden` removes Radix's built-in close (X) button.
          'flex max-h-[90vh] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl sm:max-w-md [&>button]:hidden',
        )}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Video className="h-7 w-7" />
          </div>
          <DialogTitle className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-xl font-bold text-transparent md:text-2xl">
            Video KYC
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            A quick liveness check that matches your face to your Aadhaar photo.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="scrollbar-custom mt-2 flex min-h-0 flex-1 flex-col space-y-5 overflow-y-auto"
        >
          <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-emerald-500/40 bg-slate-950 ring-1 ring-emerald-400/20">
              {aadhaarImage ? (
                <Image
                  src={aadhaarImage}
                  alt="Aadhaar photo"
                  fill
                  unoptimized
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <UserCircle2 className="h-7 w-7 text-slate-600" />
                </div>
              )}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-white">{greeting},</p>
              <p className="mt-1 break-words text-xs leading-relaxed text-slate-400">
                Your Aadhaar is verified. One final step — a short video
                verification confirms you are the person on that Aadhaar.
              </p>
            </div>
          </div>

          {aadhaarImage ? (
            <>
              <div className="space-y-2">
                {REQUIREMENTS.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-xs text-slate-300">{label}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                You will be taken to our secure verification service and brought
                back here automatically. The recording is used only for this
                identity check and is never shared with third parties.
              </div>

              <Button
                type="button"
                loading={loading}
                onClick={() => void start()}
                className="group w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
              >
                Start Video KYC
                <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
              </Button>
            </>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Your Aadhaar photo is not available, so the face match cannot run.
              Please sign in again — or contact support if this keeps happening.
            </div>
          )}
        </motion.div>

        {/* Wrapped in a div on purpose: `[&>button]:hidden` above kills every
            direct button child (that is how Radix's close X is removed). */}
        <div className="mt-4 flex shrink-0 justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={onLeave}
            className="flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to dashboard
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
