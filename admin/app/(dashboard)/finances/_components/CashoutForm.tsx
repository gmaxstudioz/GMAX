"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addCashout } from "@/lib/actions/finance";
import { Plus } from "lucide-react";

type StudioOption = { id: string; name: string };

export function CashoutForm({
    studios,
    categories,
    today,
}: {
    studios: StudioOption[];
    categories: string[];
    today: string;
}) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [category, setCategory] = useState("");
    const [customCategory, setCustomCategory] = useState("");
    const formRef = useRef<HTMLFormElement>(null);
    const isCustomCategory = category === "__new_category__";

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
            const result = await addCashout(null, formData);
            if (result.status === "error") {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            formRef.current?.reset();
            setCategory("");
            setCustomCategory("");
            setOpen(false);
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={studios.length === 0}>
                    <Plus className="size-4" />
                    Add transaction
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add a cashout</DialogTitle>
                    <DialogDescription>Record a business expense against a studio.</DialogDescription>
                </DialogHeader>
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cashout-description">What did you spend on?</Label>
                        <Input
                            id="cashout-description"
                            name="description"
                            placeholder="e.g. Camera lens repair"
                            maxLength={120}
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
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cashout-date">Date</Label>
                            <Input id="cashout-date" name="expenseDate" type="date" defaultValue={today} required />
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
                                defaultValue={studios.length === 1 ? studios[0].id : undefined}
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
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending || studios.length === 0}>
                            {isPending ? "Saving..." : "Save transaction"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
