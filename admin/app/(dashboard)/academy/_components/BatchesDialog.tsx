"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { createBatch, deleteBatch } from "@/lib/actions/academy";
import { toast } from "sonner";
import { format } from "date-fns";

type Batch = {
    id: string;
    name: string;
    startDate: Date | string;
    endDate: Date | string;
};

type BatchesDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    course: {
        id: string;
        title: string;
        batches: Batch[];
    };
};

export function BatchesDialog({ open, onOpenChange, course }: BatchesDialogProps) {
    const [batches, setBatches] = useState<Batch[]>(course.batches || []);
    const [isLoading, setIsLoading] = useState(false);

    // New batch state
    const [newName, setNewName] = useState("");
    const [newStartDate, setNewStartDate] = useState("");
    const [newEndDate, setNewEndDate] = useState("");

    async function handleAddBatch() {
        if (!newName || !newStartDate || !newEndDate) {
            toast.error("Please fill in all fields");
            return;
        }
        setIsLoading(true);
        try {
            const batch = await createBatch({
                courseId: course.id,
                name: newName,
                startDate: newStartDate,
                endDate: newEndDate,
            });
            setBatches([...batches, batch as Batch]);
            setNewName("");
            setNewStartDate("");
            setNewEndDate("");
            toast.success("Batch added successfully");
        } catch {
            toast.error("Failed to add batch");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleDeleteBatch(id: string) {
        if (!confirm("Are you sure?")) return;
        setIsLoading(true);
        try {
            await deleteBatch(id);
            setBatches(batches.filter(b => b.id !== id));
            toast.success("Batch deleted");
        } catch {
            toast.error("Failed to delete batch");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Manage Batches - {course.title}</DialogTitle>
                    <DialogDescription>Add or remove batches for this course.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-4">
                        {batches.map((batch) => (
                            <div key={batch.id} className="flex items-center gap-4 p-3 border rounded-md">
                                <div className="flex-1 font-medium">{batch.name}</div>
                                <div className="text-sm text-muted-foreground w-32">
                                    {format(new Date(batch.startDate), "MMM d, yyyy")}
                                </div>
                                <div className="text-sm text-muted-foreground w-32">
                                    {format(new Date(batch.endDate), "MMM d, yyyy")}
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-destructive"
                                    onClick={() => handleDeleteBatch(batch.id)}
                                    disabled={isLoading}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {batches.length === 0 && (
                            <div className="text-center p-4 border border-dashed rounded-md text-muted-foreground">
                                No batches added yet.
                            </div>
                        )}
                    </div>

                    <div className="border-t pt-4 mt-4 space-y-4">
                        <h4 className="font-medium text-sm">Add New Batch</h4>
                        <div className="flex items-end gap-3">
                            <div className="grid gap-2 flex-1">
                                <Label>Batch Name (e.g. Batch A)</Label>
                                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Batch Name" />
                            </div>
                            <div className="grid gap-2 flex-1">
                                <Label>Start Date</Label>
                                <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
                            </div>
                            <div className="grid gap-2 flex-1">
                                <Label>End Date</Label>
                                <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
                            </div>
                            <Button onClick={handleAddBatch} disabled={isLoading}>
                                <Plus className="h-4 w-4 mr-2" /> Add
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
