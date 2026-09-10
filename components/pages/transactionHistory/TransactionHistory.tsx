'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomTable } from '@/components/ui/custom-table';
import { get } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useEffect, useState } from "react";
import {
  Receipt,
  CreditCard,
  Wallet,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import Pagination from '@/components/common/Pagination';
import { Badge } from '@/components/ui/badge';

interface TransactionData {
  txn_id: string;
  bank_reference: string;
  amount: number;
  credited_amount: number;
  payment_group: string;
  status: string;
  created_at: string;
}

const getStatusBadge = (status: string) => {
  const statusLower = status?.toLowerCase();
  if (statusLower === 'success' || statusLower === 'completed') {
    return (
      <Badge className="flex items-center gap-1.5 rounded-xl border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  } else if (statusLower === 'pending') {
    return (
      <Badge className="flex items-center gap-1.5 rounded-xl border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
        <Clock className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  } else {
    return (
      <Badge className="flex items-center gap-1.5 rounded-xl border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
        <XCircle className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  }
};

const TransactionHistory = () => {
  const [tableData, setTableData] = useState<TransactionData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [loading, setLoading] = useState(false);

  const columns = [
    {
      title: 'Transaction ID',
      dataIndex: 'txn_id',
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800">
            <Receipt className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <span className="font-mono text-xs">{text}</span>
        </div>
      ),
    },
    {
      title: 'Bank Reference',
      dataIndex: 'bank_reference',
      render: (text: string) => (
        <span className="font-mono text-xs text-slate-400">{text || '-'}</span>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      render: (text: number) => (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-white">
            {text?.toLocaleString() || 0}
          </span>
        </div>
      ),
    },
    {
      title: 'Credited',
      dataIndex: 'credited_amount',
      render: (text: number) => (
        <div className="flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold text-emerald-400">
            {text?.toLocaleString() || 0}
          </span>
        </div>
      ),
    },
    {
      title: 'Payment Method',
      dataIndex: 'payment_group',
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800">
            <CreditCard className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <span className="text-sm uppercase">{text || '-'}</span>
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
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <span className="text-xs text-slate-400">{formatDate(text)}</span>
        </div>
      ),
    },
  ];

  const populateTableData = async () => {
    try {
      setLoading(true);
      const data = await get(
        `/api/payments/getAllTxns?page=${currentPage}&page_size=${pageSize}`,
      );
      setTableData(data?.responseData?.result || []);
      setTotalRecords(data?.responseData?.paginationDetails?.count || 0);
    } catch (err) {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    populateTableData();
  }, [currentPage, pageSize]);

  const handlePageSizeChange = (size: number) => {
    setCurrentPage(1);
    setPageSize(size);
  };

  return (
    <Card className="rounded-xl border-slate-800 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-emerald-400">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
              <Wallet className="h-4 w-4" />
            </div>
            Transaction History
          </CardTitle>
          <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 px-3 py-1.5">
            <Receipt className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">
              {totalRecords} Transactions
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CustomTable
          // @ts-expect-error - columns type dynamic mismatch in UI component
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
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
