'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PaginationProps {
  currentPage: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function Pagination({
  currentPage,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / Math.max(pageSize, 1)));
  const maxPageNumbers = 5;

  const getPageNumbers = () => {
    const half = Math.floor(maxPageNumbers / 2);
    let start = Math.max(1, currentPage - half);
    const end = Math.min(totalPages, start + maxPageNumbers - 1);

    if (end - start < maxPageNumbers - 1) {
      start = Math.max(1, end - maxPageNumbers + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    onPageChange(page);
  };

  const handlePageSizeChange = (value: string) => {
    const nextSize = Number(value);
    if (!Number.isFinite(nextSize) || nextSize <= 0) return;
    onPageSizeChange(nextSize);
  };

  if (totalRecords === 0) return null;

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="border-t border-white/[0.06] pt-4">
      <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
        <div className="flex flex-col items-center gap-4 text-sm text-slate-400 sm:flex-row">
          <div className="font-medium text-slate-300">
            Showing{' '}
            <span className="text-emerald-400">{startRecord}-{endRecord}</span>{' '}
            of{' '}
            <span className="text-emerald-400">{totalRecords}</span>{' '}
            results
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Show:</span>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-9 w-[78px] border border-white/[0.08] bg-[#0D1117] text-slate-200 shadow-sm transition hover:border-emerald-500/40 hover:text-white data-[placeholder]:text-slate-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border border-white/[0.08] bg-[#0D1117] text-slate-200">
                {pageSizeOptions.map((size) => (
                  <SelectItem
                    key={size}
                    value={size.toString()}
                    className="text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-300 focus:bg-emerald-500/10 focus:text-emerald-300"
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="h-9 border-white/[0.08] bg-[#0D1117] px-3 text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="mx-1 flex items-center gap-1">
            {getPageNumbers().map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                onClick={() => handlePageChange(page)}
                className={
                  page === currentPage
                    ? 'h-9 w-9 border-emerald-500/40 bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-500'
                    : 'h-9 w-9 border-white/[0.08] bg-[#0D1117] text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300'
                }
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-9 border-white/[0.08] bg-[#0D1117] px-3 text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
