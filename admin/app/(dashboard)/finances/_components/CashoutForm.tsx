"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addCashout, updateCashout } from "@/lib/actions/finance";
import { Pencil, Plus } from "lucide-react";

type StudioOption = { id: string; name: string };
type CashoutRecord = {
    id: string;
    studioId: string;
    description: string;
    category: string;
    amount: number;
    expenseDate: string;
    notes: string | null;
};

export function CashoutForm({
    studios,
    categories,
    today,
    cashout,
}: {
    studios: StudioOption[];
    categories: string[];
    today: string;
    cashout?: CashoutRecord;
}) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [category, setCategory] = useState(cashout?.category ?? "");
    const [customCategory, setCustomCategory] = useState("");
    const [studioId, setStudioId] = useState(cashout?.studioId ?? (studios.length === 1 ? studios[0].id : ""));
    const formRef = useRef<HTMLFormElement>(null);
    const isCustomCategory = category === "__new_category__";

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
            const result = cashout
                ? await updateCashout(cashout.id, formData)
                : await addCashout(null, formData);
            if (result.status === "error") {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            formRef.current?.reset();
            if (!cashout) {
                setCategory("");
                setCustomCategory("");
                setStudioId(studios.length === 1 ? studios[0].id : "");
            }
            setOpen(false);
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant={cashout ? "ghost" : "default"}
                    size={cashout ? "icon-sm" : "default"}
                    aria-label={cashout ? `Edit ${cashout.description}` : undefined}
                    disabled={studios.length === 0}
                >
                    {cashout ? <Pencil className="size-4" /> : <><Plus className="size-4" />Add transaction</>}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{cashout ? "Edit cashout" : "Add a cashout"}</DialogTitle>
                    <DialogDescription>
                        {cashout ? "Update the expense details." : "Record a business expense against a studio."}
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cashout-description">What did you spend on?</Label>
                        <Input
                            id="cashout-description"
                            name="description"
                            placeholder="e.g. Camera lens repair"
                            maxLength={120}
                            defaultValue={cashout?.description}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="cashout-amount">Amount (NGN)</Label>
                            <Input
                                id="cashout-amount"
                                name="amount"
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="0.00"
                                defaultValue={cashout?.amount}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cashout-date">Date</Label>
                            <Input
                                id="cashout-date"
                                name="expenseDate"
                                type="date"
                                defaultValue={cashout?.expenseDate.slice(0, 10) ?? today}
                                required
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="cashout-category">Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger id="cashout-category" className="w-full">
                                    <SelectValue placeholder="Choose a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((item) => (
                                        <SelectItem key={item} value={item}>{item}</SelectItem>
                                    ))}
                                    <SelectItem value="__new_category__">+ Add a new category</SelectItem>
                                </SelectContent>
                            </Select>
                            <input type="hidden" name="category" value={isCustomCategory ? customCategory : category} />
                            {isCustomCategory && (
                                <Input
                                    aria-label="New cashout category"
                                    value={customCategory}
                                    onChange={(event) => setCustomCategory(event.target.value)}
                                    placeholder="Enter a new category"
                                    maxLength={50}
                                    required
                                />
                            )}
                            <p className="text-xs text-muted-foreground">Choose a saved category or add a new one.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cashout-studio">Studio</Label>
                            <Select
                                name="studioId"
                                required
                                value={studioId}
                                onValueChange={setStudioId}
                            >
                                <SelectTrigger id="cashout-studio" className="w-full">
                                    <SelectValue placeholder="Select studio" />
                                </SelectTrigger>
                                <SelectContent>
                                {studios.map((studio) => (
                                    <SelectItem key={studio.id} value={studio.id}>{studio.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cashout-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
                        <Textarea
                            id="cashout-notes"
                            name="notes"
                            placeholder="Add any useful details"
                            maxLength={500}
                            rows={2}
                            defaultValue={cashout?.notes ?? ""}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending || studios.length === 0}>
                            {isPending ? "Saving..." : cashout ? "Save changes" : "Save transaction"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
