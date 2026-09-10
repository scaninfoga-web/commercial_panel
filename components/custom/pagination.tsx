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
  pageSizeOptions?: number[]; // Optional page sizes
}

export default function Pagination({
  currentPage,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const totalPages = Math.ceil(totalRecords / pageSize);
  const maxPageNumbers = 5;

  const getPageNumbers = () => {
    const half = Math.floor(maxPageNumbers / 2);
    let start = Math.max(1, currentPage - half);
    const end = Math.min(totalPages, start + maxPageNumbers - 1);

    if (end - start < maxPageNumbers - 1) {
      start = Math.max(1, end - maxPageNumbers + 1);
    }

    const pages = [];
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
    onPageSizeChange(Number(value));
  };

  if (totalRecords === 0) return null;

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="py-2">
      <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
        {/* Records Info & Page Size Selector */}
        <div className="flex flex-col items-center gap-4 text-sm text-slate-600 dark:text-slate-400 sm:flex-row">
          <div className="font-medium">
            Showing{' '}
            <span className="text-emerald-600 dark:text-emerald-400">
              {startRecord}-{endRecord}
            </span>{' '}
            of{' '}
            <span className="text-emerald-600 dark:text-emerald-400">
              {totalRecords}
            </span>{' '}
            results
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Show:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger className="h-8 w-[70px] border-slate-300 bg-indigo-200 transition-colors hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-indigo-200 text-black dark:border-slate-700 dark:bg-slate-800">
                {pageSizeOptions.map((size) => (
                  <SelectItem
                    key={size}
                    value={size.toString()}
                    className="hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-1">
          {/* Previous Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {/* Page Numbers */}
          <div className="mx-2 flex items-center gap-1">
            {getPageNumbers().map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                onClick={() => handlePageChange(page)}
                className={`h-9 w-9 transition-all duration-200 ${
                  page === currentPage
                    ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600'
                    : 'border-slate-300 hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-600 dark:hover:border-emerald-500 dark:hover:bg-emerald-950'
                }`}
              >
                {page}
              </Button>
            ))}
          </div>

          {/* Next Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
