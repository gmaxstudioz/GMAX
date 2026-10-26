"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CopyIcon, Building2, Check, ArrowRight, LayersIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  cloneService,
  cloneServicesBulk,
  cloneCategory,
  getClonableStudios,
} from "@/lib/actions/service";

export type CloneMode = "single" | "group" | "category";

export interface CloneDialogState {
  open: boolean;
  mode: CloneMode;
  service?: {
    id: string;
    name: string;
    category?: string;
    serviceVariants?: any[];
  };
  services?: Array<{
    id: string;
    name: string;
    category?: string;
    serviceVariants?: any[];
  }>;
  category?: "PHOTOGRAPHY" | "VIDEOGRAPHY" | "OTHERS" | string;
  categoryCount?: number;
}

interface CloneServicesDialogProps {
  state: CloneDialogState;
  onOpenChange: (open: boolean) => void;
  currentStudio: {
    id: string;
    name: string;
    slug: string;
  };
  onSuccess?: () => void;
}

export function CloneServicesDialog({
  state,
  onOpenChange,
  currentStudio,
  onSuccess,
}: CloneServicesDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [studios, setStudios] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [isLoadingStudios, setIsLoadingStudios] = useState(false);
  const [targetStudioId, setTargetStudioId] = useState<string>("");

  // Load accessible studios when modal opens
  useEffect(() => {
    if (state.open) {
      setIsLoadingStudios(true);
      getClonableStudios()
        .then((data) => {
          setStudios(data);
          // Default to first studio that is NOT current studio if available, otherwise current
          const otherStudio = data.find((s) => s.id !== currentStudio.id);
          setTargetStudioId(otherStudio ? otherStudio.id : currentStudio.id);
        })
        .catch((err) => {
          console.error("Failed to load studios", err);
          toast.error("Could not load studios for cloning");
        })
        .finally(() => {
          setIsLoadingStudios(false);
        });
    }
  }, [state.open, currentStudio.id]);

  const selectedTarget = studios.find((s) => s.id === targetStudioId);
  const isSameStudio = targetStudioId === currentStudio.id;

  const handleClone = () => {
    if (!targetStudioId) {
      toast.error("Please select a target studio.");
      return;
    }

    startTransition(async () => {
      try {
        if (state.mode === "single" && state.service) {
          const res = await cloneService(state.service.id, targetStudioId);
          if (res.status === "success") {
            toast.success(res.message, {
              action: !isSameStudio && selectedTarget
                ? {
                    label: `Open ${selectedTarget.name}`,
                    onClick: () => router.push(`/studios/${selectedTarget.slug}`),
                  }
                : undefined,
            });
            onOpenChange(false);
            onSuccess?.();
          } else {
            toast.error(res.message || "Failed to clone service");
          }
        } else if (state.mode === "group" && state.services && state.services.length > 0) {
          const ids = state.services.map((s) => s.id);
          const res = await cloneServicesBulk(ids, targetStudioId);
          if (res.status === "success") {
            toast.success(res.message, {
              action: !isSameStudio && selectedTarget
                ? {
                    label: `Open ${selectedTarget.name}`,
                    onClick: () => router.push(`/studios/${selectedTarget.slug}`),
                  }
                : undefined,
            });
            onOpenChange(false);
            onSuccess?.();
          } else {
            toast.error(res.message || "Failed to clone selected services");
          }
        } else if (state.mode === "category" && state.category) {
          const res = await cloneCategory(
            currentStudio.id,
            state.category as "PHOTOGRAPHY" | "VIDEOGRAPHY" | "OTHERS",
            targetStudioId
          );
          if (res.status === "success") {
            toast.success(res.message, {
              action: !isSameStudio && selectedTarget
                ? {
                    label: `Open ${selectedTarget.name}`,
                    onClick: () => router.push(`/studios/${selectedTarget.slug}`),
                  }
                : undefined,
            });
            onOpenChange(false);
            onSuccess?.();
          } else {
            toast.error(res.message || "Failed to clone category");
          }
        }
      } catch (err) {
        console.error("Clone error:", err);
        toast.error("An unexpected error occurred while cloning.");
      }
    });
  };

  const dialogTitle =
    state.mode === "single"
      ? `Clone Service`
      : state.mode === "group"
      ? `Clone Selected Services (${state.services?.length || 0})`
      : `Clone Category: ${state.category || ""}`;

  const dialogDescription =
    state.mode === "single"
      ? `Duplicate "${state.service?.name}" into another studio or make a copy within this studio.`
      : state.mode === "group"
      ? `Copy ${state.services?.length || 0} selected services into a destination studio.`
      : `Copy all services in the ${state.category} category to another studio.`;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wide uppercase mb-1">
            <CopyIcon className="size-3.5" />
            <span>Service Cloning</span>
          </div>
          <DialogTitle className="text-xl font-bold">{dialogTitle}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Studio Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Destination Studio</span>
              {isLoadingStudios && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-normal lowercase">
                  <Loader2 className="size-3 animate-spin" /> loading studios...
                </span>
              )}
            </label>

            {studios.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg bg-muted/20">
                {studios.map((st) => {
                  const isCurrent = st.id === currentStudio.id;
                  const isSelected = st.id === targetStudioId;

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setTargetStudioId(st.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-md border text-left text-xs transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-xs font-medium"
                          : "border-border/60 hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`size-7 rounded-md flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Building2 className="size-3.5" />
                        </div>
                        <div className="truncate">
                          <p className="font-semibold text-sm leading-tight truncate">{st.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">/{st.slug}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent ? (
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            Current Studio
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                            Target
                          </Badge>
                        )}
                        {isSelected && <Check className="size-4 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 border rounded-lg text-center text-xs text-muted-foreground">
                No accessible destination studios found.
              </div>
            )}
          </div>

          {/* Transfer Summary Card */}
          <div className="p-3 rounded-lg border bg-card/60 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground font-medium pb-1.5 border-b">
              <span>Transfer summary</span>
              <span className="flex items-center gap-1 font-semibold text-foreground">
                {currentStudio.name} <ArrowRight className="size-3 text-muted-foreground" />{" "}
                {selectedTarget?.name || "Target"}
              </span>
            </div>

            {state.mode === "single" && state.service && (
              <div className="flex items-center justify-between pt-1">
                <span className="font-medium text-foreground">{state.service.name}</span>
                {state.service.category && (
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {state.service.category}
                  </Badge>
                )}
              </div>
            )}

            {state.mode === "group" && state.services && (
              <div className="space-y-1.5 pt-1">
                <p className="text-muted-foreground text-[11px]">
                  {state.services.length} services will be cloned with all their variants, prices, and deliverables:
                </p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {state.services.map((s) => (
                    <span
                      key={s.id}
                      className="px-2 py-0.5 rounded bg-muted text-[11px] font-medium border"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {state.mode === "category" && (
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <LayersIcon className="size-3.5 text-primary" />
                  All services in {state.category}
                </span>
                <Badge variant="secondary" className="font-semibold text-xs">
                  {state.categoryCount ?? "All"} services
                </Badge>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded border border-border/40 mt-2">
              {isSameStudio ? (
                <span>
                  💡 Cloning to the <strong>same studio</strong> creates duplicate copies with a{" "}
                  <code className="text-[10px] font-mono bg-background px-1 py-0.5 rounded border">
                    (Copy)
                  </code>{" "}
                  suffix.
                </span>
              ) : (
                <span>
                  ✨ Cloning to <strong>{selectedTarget?.name}</strong> maps studio sessions automatically and copies all variants, prices, and deliverable items.
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={isPending || !targetStudioId}
            className="gap-2 font-medium"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Cloning...</span>
              </>
            ) : (
              <>
                <CopyIcon className="size-4" />
                <span>
                  {state.mode === "single"
                    ? "Clone Service"
                    : state.mode === "group"
                    ? `Clone ${state.services?.length || 0} Services`
                    : `Clone ${state.category} Category`}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
