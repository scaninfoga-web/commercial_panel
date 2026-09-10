'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CustomTable } from '@/components/custom/custom-table';
import { get } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import {
  Receipt,
  CreditCard,
  Wallet,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Smartphone,
  Landmark,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import Pagination from '@/components/common/Pagination';

interface TransactionData {
  txn_id: string;
  bank_reference: string;
  amount: number;
  credited_amount: number;
  payment_group: string;
  status: string;
  created_at: string;
}

export interface ApiError {
  response?: {
    data?: {
      responseStatus?: {
        message?: string;
      };
    };
  };
}

// Same currency formatting used for the balance pill in the navbar, so
// every rupee amount in the app reads the same way.
const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount || 0);

const getStatusBadge = (status: string) => {
  const statusLower = status?.toLowerCase();
  if (statusLower === 'success' || statusLower === 'completed') {
    return (
      <Badge className="flex w-fit items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  }
  if (statusLower === 'pending') {
    return (
      <Badge className="flex w-fit items-center gap-1.5 border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
        <Clock className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  }
  return (
    <Badge className="flex w-fit items-center gap-1.5 border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
      <XCircle className="h-3 w-3" />
      {status?.toUpperCase()}
    </Badge>
  );
};

// One consistent chip style for every row icon — dark emerald-tinted
// fill with an emerald glyph, same trio used on the shield icon and the
// dashboard's stat cards. Payment methods are told apart by icon shape,
// not by a different color per type.
const getPaymentIcon = (group: string) => {
  const normalized = (group || '').toUpperCase();
  if (normalized.includes('UPI')) return Smartphone;
  if (normalized.includes('NETBANKING') || normalized.includes('BANK')) return Landmark;
  if (normalized.includes('WALLET')) return Wallet;
  return CreditCard;
};

// Shared chip used for every row icon so they read as one family instead
// of a different flat gray square per column.
const RowIconChip = ({ icon: Icon }: { icon: typeof Receipt }) => (
  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
    <Icon className="h-3.5 w-3.5 text-emerald-400" />
  </div>
);

const TransactionHistory = () => {
  const [tableData, setTableData] = useState<TransactionData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyTxnId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      toast.success('Transaction ID copied');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy transaction ID');
    }
  };

  const columns = [
    {
      title: 'Transaction ID',
      dataIndex: 'txn_id',
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <RowIconChip icon={Receipt} />
          <span className="font-mono text-xs text-slate-100">{text}</span>
          <button
            onClick={() => handleCopyTxnId(text)}
            className="rounded-md p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title="Copy transaction ID"
            aria-label="Copy transaction ID"
          >
            {copiedId === text ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ),
    },
    {
      title: 'Bank Reference',
      dataIndex: 'bank_reference',
      render: (text: string) => (
        <span className="font-mono text-xs text-slate-500">{text || '-'}</span>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      render: (text: number) => (
        <span className="font-semibold tabular-nums text-white">{formatINR(text)}</span>
      ),
    },
    {
      title: 'Credited',
      dataIndex: 'credited_amount',
      render: (text: number) => (
        <div className="flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold tabular-nums text-emerald-400">
            {formatINR(text)}
          </span>
        </div>
      ),
    },
    {
      title: 'Payment Method',
      dataIndex: 'payment_group',
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <RowIconChip icon={getPaymentIcon(text)} />
          <span className="text-sm uppercase tracking-wide text-slate-200">{text || '-'}</span>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (text: string) => getStatusBadge(text),
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <RowIconChip icon={Calendar} />
          <span className="text-xs text-slate-500">{formatDate(text)}</span>
        </div>
      ),
    },
  ];

  const populateTableData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get(
        `/api/payments/getAllTxns?page=${currentPage}&page_size=${pageSize}`,
      );
      setTableData(data?.responseData?.result || []);
      setTotalRecords(data?.responseData?.paginationDetails?.count || 0);
   } catch (err: unknown) {
  const apiError = err as ApiError; // Type-casting to safely read custom properties
  const message =
    apiError?.response?.data?.responseStatus?.message || 'Failed to load transactions';
  setError(message);
  toast.error(message);
} finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    populateTableData();
  }, [populateTableData]);

  const handlePageSizeChange = (size: number) => {
    setCurrentPage(1);
    setPageSize(size);
  };

  return (
    <Card className="rounded-2xl border border-white/[0.06] bg-[#05070B] shadow-[0_20px_60px_rgba(5,7,11,0.6)]">
      <CardHeader className="border-b border-white/[0.06] pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-emerald-400">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <Wallet className="h-4 w-4" />
            </div>
            Transaction History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
              <Receipt className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
              {totalRecords} Transactions
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white/[0.04] hover:text-white"
              onClick={populateTableData}
              disabled={loading}
              title="Refresh"
              aria-label="Refresh transactions"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 py-12 text-center text-red-300">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-auto rounded-xl border-red-500/30 px-3 text-red-300 hover:bg-red-500/10"
              onClick={populateTableData}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            <CustomTable
              // @ts-expect-error - legacy custom table API accepts a column config shape without strict typing
              columns={columns}
              dataSource={tableData}
              loading={loading}
            />
            <Pagination
              currentPage={currentPage}
              totalRecords={totalRecords}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[5, 10, 20, 50]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;