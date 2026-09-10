'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Monitor, Wifi, MapPin, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { get } from '@/lib/api';
import { CustomTable } from '@/components/ui/custom-table';
import Pagination from '@/components/common/Pagination';
import { formatDate } from '@/lib/utils';

interface LoginHistorySchema {
  id: number;
  created_at: string;
  ipAddress: string;
  browser: string;
  device: string;
  latitude: string;
  longitude: string;
}

interface Column<T> {
  title: string;
  dataIndex: keyof T;
  key?: string;
  render?: (text: T[keyof T], record: T) => React.ReactNode;
}

const columns: Column<LoginHistorySchema>[] = [
  {
    title: 'Timestamp',
    dataIndex: 'created_at',
    key: 'created_at',
    render: (text) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
        </div>
        <span className="text-sm">{formatDate(String(text))}</span>
      </div>
    ),
  },
  {
    title: 'Device',
    dataIndex: 'device',
    key: 'device',
    render: (text) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800">
          <Monitor className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <span className="text-sm">{String(text)}</span>
      </div>
    ),
  },
  {
    title: 'IP Address',
    dataIndex: 'ipAddress',
    key: 'ipAddress',
    render: (text) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800">
          <Wifi className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <span className="font-mono text-sm">{String(text)}</span>
      </div>
    ),
  },
  {
    title: 'Browser',
    dataIndex: 'browser',
    key: 'browser',
  },
  {
    title: 'Location',
    dataIndex: 'latitude',
    key: 'latitude',
    render: (_, record) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800">
          <MapPin className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <span className="text-xs text-slate-400">
          {record.latitude}, {record.longitude}
        </span>
      </div>
    ),
  },
];

export const LoginHistoryCard = () => {
  const [loginHistory, setLoginHistory] = useState<LoginHistorySchema[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);

  const populateData = async () => {
    try {
      setLoading(true);
      const data = await get(
        `/api/auth/getSessionDtls?page=${currentPage}&page_size=${pageSize}`,
      );

      setLoginHistory(data?.responseData?.result || []);
      setTotalRecords(data?.responseData?.paginationDetails?.count || 0);
    } catch (error) {
      toast.error('Error fetching login history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    populateData();
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
              <Clock className="h-4 w-4" />
            </div>
            Login History
          </CardTitle>
          <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 px-3 py-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-400">
              {totalRecords} Sessions
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CustomTable
          columns={columns}
          dataSource={loginHistory}
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
