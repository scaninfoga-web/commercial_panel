"use client";

import { useCallback, useState } from "react";
import { LifeBuoy, Plus } from "lucide-react";
import GetAllSupport, {
  type SupportListState,
} from "@/components/pages/get-support/get_all_support_doc";
import RaiseTicketPage from "@/components/pages/get-support/get_support";
import { Button } from "@/components/ui/button";

export default function Page() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listState, setListState] = useState<SupportListState>({
    hasReports: false,
    isLoading: true,
    error: null,
  });

  const handleListStateChange = useCallback((state: SupportListState) => {
    setListState(state);
    if (!state.isLoading && !state.hasReports) setIsFormOpen(true);
  }, []);

  const handleCreated = useCallback(() => {
    setIsFormOpen(false);
    setRefreshKey((key) => key + 1);
  }, []);

  return (
    <div className="flex w-full flex-col gap-5 sm:gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 sm:h-12 sm:w-12">
            <LifeBuoy className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-2xl">
              Get Support
            </h1>
            <p className="mt-0.5 truncate text-xs text-zinc-400 sm:text-sm">
              Report an issue and our team will look into it.
            </p>
          </div>
        </div>
        {!listState.isLoading && listState.hasReports && (
          <Button
            type="button"
            size="sm"
            onClick={() => setIsFormOpen(true)}
            className="shrink-0 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New ticket
          </Button>
        )}
      </header>

      <GetAllSupport
        refreshKey={refreshKey}
        onStateChange={handleListStateChange}
      />

      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Raise a support ticket"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
        >
          <div className="max-h-[95vh] w-full overflow-y-auto sm:max-w-3xl">
            <div className="relative">
              <RaiseTicketPage
                onCreated={handleCreated}
                onClose={() => setIsFormOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
