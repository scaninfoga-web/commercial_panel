import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Loader } from './loader';
import { FileX2 } from 'lucide-react';

interface Column<T> {
  title: string;
  dataIndex: keyof T;
  key?: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (text: T[keyof T], record: T, index: number) => React.ReactNode;
}

interface CustomTableProps<T> {
  columns: Column<T>[];
  dataSource: T[];
  loading?: boolean;
  scroll?: {
    x?: boolean | string | number;
    y?: string | number;
  };
  className?: string;
  emptyText?: string;
  striped?: boolean;
  hoverable?: boolean;
}

export function CustomTable<T extends object>({
  columns,
  dataSource,
  loading = false,
  scroll,
  className,
  emptyText = 'No data available',
  striped = true,
  hoverable = true,
}: CustomTableProps<T>) {
  return (
    <div
      className={cn(
        'scrollbar-custom relative w-full overflow-auto rounded-xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-xl',
        scroll?.x && 'overflow-x-auto',
        scroll?.y && 'overflow-y-auto',
        className,
      )}
      style={scroll?.y ? { maxHeight: scroll.y } : undefined}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-b border-slate-700/50 hover:bg-transparent">
            {columns.map((column, index) => (
              <TableHead
                className={cn(
                  'sticky top-0 z-10 whitespace-nowrap bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-black',
                  index === 0 && 'rounded-tl-xl',
                  index === columns.length - 1 && 'rounded-tr-xl',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                )}
                key={column.key || `col-${index}`}
                style={
                  column.width
                    ? { width: column.width, minWidth: column.width }
                    : undefined
                }
              >
                {column.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-40 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <Loader className="max-h-16" />
                  <span className="text-sm text-slate-400">
                    Loading data...
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ) : dataSource.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-40 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800/50">
                    <FileX2 className="h-7 w-7 text-slate-500" />
                  </div>
                  <span className="text-sm text-slate-400">{emptyText}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            dataSource.map((record, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={cn(
                  'border-b border-slate-700/30 transition-colors duration-200',
                  striped && rowIndex % 2 === 1 && 'bg-slate-800/30',
                  hoverable && 'hover:bg-emerald-500/5',
                )}
              >
                {columns.map((column, colIndex) => (
                  <TableCell
                    className={cn(
                      'px-4 py-3 text-sm text-slate-300',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                    )}
                    key={column.key || `cell-${rowIndex}-${colIndex}`}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.render
                      ? column.render(
                          record[column.dataIndex],
                          record,
                          rowIndex,
                        )
                      : String(record[column.dataIndex] ?? '-')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
