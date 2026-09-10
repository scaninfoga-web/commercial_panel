"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "max-w-md sm:max-w-md",
  md: "max-w-2xl sm:max-w-2xl",
  lg: "max-w-4xl sm:max-w-4xl",
  xl: "max-w-[1400px] sm:max-w-[1400px]",
};

interface ViewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  size?: keyof typeof sizeMap;
  fullHeight?: boolean;
  className?: string;
}

export const ViewDialog: React.FC<ViewDialogProps> = ({
  open,
  onOpenChange,
  title,
  icon,
  children,
  size = "md",
  fullHeight = false,
  className,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className={cn(
        "scrollbar-custom w-[95vw] overflow-y-auto border-slate-800 bg-[#0b1220] text-slate-200",
        sizeMap[size],
        fullHeight && "h-[92vh]",
        className,
      )}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-emerald-400">
          {icon}
          {title}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4 pt-2">{children}</div>
    </DialogContent>
  </Dialog>
);

export default ViewDialog;
