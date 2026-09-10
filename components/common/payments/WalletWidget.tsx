'use client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn, formatDate } from '@/lib/utils';
import { AppDispatch, RootState } from '@/redux/store';
import {
  fetchWalletBalance,
  TransactionType,
  TransactionStatus,
} from '@/redux/walletSlice';
import { RefreshCw, IndianRupee, Receipt, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

interface WalletWidgetProps {
  credits: number;
  walletLoading: boolean;
}

const STATUS_STYLES: Record<TransactionStatus, string> = {
  [TransactionStatus.COMPLETED]: 'text-emerald-400',
  [TransactionStatus.PENDING]: 'text-amber-400',
  [TransactionStatus.FAILED]: 'text-red-400',
  [TransactionStatus.REVERSED]: 'text-orange-400',
};

export const WalletWidget = ({ credits, walletLoading }: WalletWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const wallet = useSelector((state: RootState) => state.wallet);
  const dispatch = useDispatch<AppDispatch>();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="group relative flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/25 bg-gradient-to-r from-emerald-500/5 to-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:shadow-lg hover:shadow-emerald-500/10"
        >
          <IndianRupee className="h-3.5 w-3.5 text-emerald-400" />
          {walletLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
          ) : (
            <span className="tabular-nums text-emerald-300">₹{credits.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          )}
          <RefreshCw
            className="h-3 w-3 text-emerald-400/70 transition-transform duration-300 group-hover:rotate-180 group-hover:text-emerald-300"
            onClick={(e) => {
              e.stopPropagation();
              dispatch(fetchWalletBalance());
            }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[calc(100vw-1rem)] rounded-xl border border-slate-700/40 bg-gradient-to-b from-slate-900/95 to-slate-900/90 p-0 shadow-2xl sm:w-96">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between border-b border-slate-700/30 px-4 py-3 sm:px-5 sm:py-4">
          <h3 className="text-sm font-semibold text-white sm:text-base">
            Transaction History
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 text-white transition-colors hover:bg-slate-800/50"
            aria-label="Close"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-4 py-4 sm:max-h-[60vh] sm:px-5">
          {/* Balance Summary - Compact */}
          <div className="rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-emerald-200/70">
                  <IndianRupee className="h-3 w-3" />
                  <span className="text-xs font-medium">Balance</span>
                </div>
                <div className="mt-1 text-lg font-bold text-emerald-300">
                  ₹{credits.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Recent Activity
            </h4>
            <div className="space-y-1.5">
              {wallet.transactions && wallet.transactions.length > 0 ? (
                wallet.transactions.slice(0, 8).map((txn) => (
                  <div
                    key={txn.id}
                    className="rounded-lg border border-slate-700/30 bg-slate-800/20 p-2 transition-all duration-200 hover:border-slate-700/50 hover:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px]',
                            txn.type === TransactionType.CREDIT
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : txn.type === TransactionType.TRANSFER
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-red-500/20 text-red-400',
                          )}
                        >
                          <IndianRupee className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-white">
                            {txn.description}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatDate(txn.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            'text-xs font-semibold',
                            txn.status === TransactionStatus.REVERSED ||
                              txn.status === TransactionStatus.FAILED
                              ? 'text-slate-500 line-through'
                              : txn.type === TransactionType.CREDIT
                                ? 'text-emerald-400'
                                : txn.type === TransactionType.TRANSFER
                                  ? 'text-blue-400'
                                  : 'text-red-400',
                          )}
                        >
                          {txn.type === TransactionType.CREDIT ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                        </p>
                        <p
                          className={cn(
                            'text-[9px] font-medium uppercase tracking-tight',
                            STATUS_STYLES[txn.status] ?? 'text-slate-400',
                          )}
                        >
                          {txn.status}
                        </p>
                      </div>
                    </div>
                    {txn.transaction_utr && (
                      <div className="mt-1 flex items-center gap-1 border-t border-slate-700/20 pt-1">
                        <Receipt className="h-2 w-2 shrink-0 text-slate-500" />
                        <span className="truncate font-mono text-[9px] text-slate-400">
                          {txn.transaction_utr}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-700/30 bg-slate-800/10 p-4 text-center">
                  <Receipt className="mx-auto mb-1.5 h-5 w-5 text-slate-500" />
                  <p className="text-xs text-slate-400">
                    No transactions yet
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
