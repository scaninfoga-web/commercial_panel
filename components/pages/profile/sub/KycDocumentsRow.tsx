'use client';

import { useCallback, useState } from 'react';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { Eye, FileText, Loader2, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AadhaarKycTabs from '@/components/kyc/sub/AadhaarKycTabs';
import { get } from '@/lib/api';
import type { AadhaarKycDataResponse, AadhaarKycRecord } from '@/types/kyc';

function extractError(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return (
      err.response?.data?.responseStatus?.message ||
      err.response?.data?.message ||
      fallback
    );
  }
  return fallback;
}

/**
 * "KYC Documents" row for the profile card — opens a dialog that pulls the
 * stored Aadhaar KYC record and renders it across four tabs.
 */
export default function KycDocumentsRow(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<AadhaarKycRecord | null>(null);

  const loadKyc = useCallback(async () => {
    // The record never changes mid-session — fetch it once.
    if (record) return;
    setLoading(true);
    try {
      const response = await get<{
        responseStatus?: { status?: boolean; message?: string };
        responseData?: AadhaarKycDataResponse;
      }>('/api/v1/kyc/aadhaar-kyc-data');

      const kyc = response?.responseData?.kyc ?? null;
      if (!response?.responseStatus?.status || !kyc?.aadhaar_kyc_data?.data) {
        toast.error(
          response?.responseStatus?.message || 'Unable to load KYC documents.',
        );
        return;
      }
      setRecord(kyc);
    } catch (err) {
      toast.error(extractError(err, 'Unable to load KYC documents.'));
    } finally {
      setLoading(false);
    }
  }, [record]);

  const data = record?.aadhaar_kyc_data?.data ?? null;

  return (
    <>
      <div className="group flex flex-col gap-2 rounded-xl border border-slate-800/50 bg-slate-900/30 px-3 py-2.5 transition-all duration-300 hover:border-emerald-500/30 hover:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 sm:h-8 sm:w-8">
            <FileText className="h-3.5 w-3.5 text-emerald-400 sm:h-4 sm:w-4" />
          </div>
          <span className="whitespace-nowrap text-xs text-slate-400 sm:text-sm">
            KYC Documents
          </span>
        </div>
        {/* Plain button: `Button` force-appends `w-full`, which would stretch
            this trigger across the whole row. */}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            void loadKyc();
          }}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 self-start rounded-xl border border-emerald-500/50 px-2.5 text-xs font-medium text-emerald-400 transition-colors hover:border-emerald-400 hover:bg-emerald-500/10 sm:self-auto"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#060b17]/95 backdrop-blur-xl sm:max-w-5xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-xl font-bold text-transparent">
              KYC Documents
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Your Aadhaar identity as verified with UIDAI.
            </DialogDescription>
          </DialogHeader>

          <div className="scrollbar-custom min-h-0 flex-1 overflow-y-auto pr-1">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                <p className="text-sm">Fetching your Aadhaar KYC record…</p>
              </div>
            )}

            {!loading && data && (
              <AadhaarKycTabs
                data={data}
                kycAddress={record?.kyc_address}
                verifiedAt={record?.verified_at}
                lastUpdatedAt={record?.last_updated_at}
              />
            )}

            {!loading && !data && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <ShieldAlert className="h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-400">
                  No KYC record found for your account.
                </p>
                <button
                  type="button"
                  onClick={() => void loadKyc()}
                  className="inline-flex h-8 items-center rounded-xl border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
