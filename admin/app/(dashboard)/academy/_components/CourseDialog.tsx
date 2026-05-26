"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCourse, updateCourse } from "@/lib/actions/academy";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

type CourseData = {
    id: string;
    title: string;
    description: string;
    price: number | string;
    duration?: string | null;
    location?: string | null;
    thumbnail?: string | null;
    isPublished: boolean;
};

export function CourseDialog({ open, onOpenChange, course }: { open: boolean, onOpenChange: (open: boolean) => void, course: CourseData | null }) {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [thumbnail, setThumbnail] = useState(course?.thumbnail || "");

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files?.[0]) return;
        setUploading(true);
        const file = e.target.files[0];
        
        try {
            // 1. Get presigned URL
            const res = await fetch("/api/s3/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    isImage: file.type.startsWith("image/"),
                    directory: "academy/thumbnails"
                })
            });
            if (!res.ok) throw new Error("Failed to get upload URL");
            const data = await res.json();
            
            // 2. Upload file to presigned URL
            const uploadRes = await fetch(data.presignedUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type
                }
            });
            
            if (!uploadRes.ok) throw new Error("Failed to upload file to S3");
            
            setThumbnail(data.key);
            toast.success("Thumbnail uploaded");
        } catch (err) {
            console.error(err);
            toast.error("Failed to upload thumbnail");
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        
        const data = {
            title: formData.get("title") as string,
            description: formData.get("description") as string,
            price: Number(formData.get("price")),
            duration: formData.get("duration") as string,
            location: formData.get("location") as string,
            thumbnail: thumbnail,
            isPublished: formData.get("isPublished") === "on",
        };

        try {
            if (course) {
                await updateCourse(course.id, data);
                toast.success("Course updated successfully");
            } else {
                await createCourse(data);
                toast.success("Course created successfully");
            }
            onOpenChange(false);
        } catch {
            toast.error("Failed to save course");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{course ? "Edit Course" : "New Course"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" name="title" defaultValue={course?.title} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" name="description" defaultValue={course?.description} required rows={3} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price">Price (₦)</Label>
                            <Input id="price" name="price" type="number" defaultValue={course?.price ? Number(course.price) : ""} required min="0" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="duration">Duration</Label>
                            <Input id="duration" name="duration" placeholder="e.g. 3-4 weeks" defaultValue={course?.duration || ""} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input id="location" name="location" placeholder="e.g. Studio / Online" defaultValue={course?.location || ""} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Thumbnail</Label>
                        <div className="flex items-center gap-4">
                            {thumbnail && (
                                <div className="w-16 h-16 rounded overflow-hidden bg-muted relative shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.startsWith('http') ? '' : 'https://'}${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${thumbnail}`} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                            )}
                            <Input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between border rounded-lg p-4">
                        <div className="space-y-0.5">
                            <Label>Publish Course</Label>
                            <p className="text-xs text-muted-foreground">Make this course visible on the public academy page.</p>
                        </div>
                        <Switch name="isPublished" defaultChecked={course?.isPublished} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading || uploading}>{loading ? "Saving..." : "Save Course"}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
