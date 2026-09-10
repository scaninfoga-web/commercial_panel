'use client';

import { type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; 

interface ModalProps {
  open: boolean;
  title?: string;
  children?: ReactNode;
  onClose: () => void;
  onOk?: () => void;
  okText?: string;
  cancelText?: string;
  loading?: boolean;
  showFooter?: boolean;
  className?: string;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  onOk,
  okText = 'OK',
  cancelText = 'Cancel',
  loading = false,
  showFooter = true,
  className, 
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        className={cn(
          "border-gray-500 bg-black max-h-1/2 overflow-auto",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-emerald-500">{title || ''}</DialogTitle>
        </DialogHeader>

        <div className="py-2">{children}</div>

        {showFooter && (
          <DialogFooter className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              {cancelText}
            </Button>
            <Button onClick={onOk} disabled={loading}>
              {loading ? 'Loading...' : okText}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}