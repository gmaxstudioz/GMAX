"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createModule, deleteModule } from "@/lib/actions/academy";
import { toast } from "sonner";
import { GripVertical, Plus, Trash2 } from "lucide-react";

type ModuleData = {
    id: string;
    title: string;
    description: string | null;
};

export function ModulesDialog({ open, onOpenChange, course }: { open: boolean, onOpenChange: (open: boolean) => void, course: { id: string; title: string; modules: ModuleData[] } }) {
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);

    async function handleAddSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        
        try {
            await createModule({
                courseId: course.id,
                title: formData.get("title") as string,
                description: formData.get("description") as string,
                sortOrder: course.modules.length,
            });
            toast.success("Module added");
            setAdding(false);
        } catch {
            toast.error("Failed to add module");
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this module?")) return;
        try {
            await deleteModule(id);
            toast.success("Module deleted");
        } catch {
            toast.error("Failed to delete module");
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Modules for {course.title}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    {course.modules.length === 0 ? (
                        <div className="text-center p-4 border border-dashed rounded-lg text-muted-foreground text-sm">
                            No modules added yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {course.modules.map((module: ModuleData, idx: number) => (
                                <div key={module.id} className="flex items-center gap-4 p-3 border rounded-lg bg-card">
                                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-move" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm">Module {idx + 1}: {module.title}</div>
                                        {module.description && <div className="text-xs text-muted-foreground truncate">{module.description}</div>}
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => handleDelete(module.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {!adding ? (
                        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
                            <Plus className="h-4 w-4 mr-2" /> Add Module
                        </Button>
                    ) : (
                        <form onSubmit={handleAddSubmit} className="p-4 border rounded-lg space-y-4 bg-muted/20">
                            <h4 className="font-medium text-sm">New Module</h4>
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" name="title" required placeholder="e.g. Introduction to Photography" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Textarea id="description" name="description" rows={2} />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                                <Button type="submit" size="sm" disabled={loading}>{loading ? "Saving..." : "Add Module"}</Button>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
