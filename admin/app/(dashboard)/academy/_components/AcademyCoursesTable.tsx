"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Edit, LayoutList, Plus, Trash2 } from "lucide-react";
import { CourseDialog } from "./CourseDialog";
import { ModulesDialog } from "./ModulesDialog";
import { BatchesDialog } from "./BatchesDialog";
import { deleteCourse, updateCourse } from "@/lib/actions/academy";
import { toast } from "sonner";
import Image from "next/image";
import { Switch } from "@/components/ui/switch";

type CourseWithStats = {
    id: string;
    title: string;
    description: string;
    price: number | string;
    duration?: string | null;
    location?: string | null;
    isPublished: boolean;
    thumbnail: string | null;
    createdAt: Date;
    _count: {
        modules: number;
        students: number;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modules: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    batches: any[];
};

export function AcademyCoursesTable({ courses }: { courses: CourseWithStats[] }) {
    const [isCourseDialogOpen, setCourseDialogOpen] = useState(false);
    const [isModulesDialogOpen, setModulesDialogOpen] = useState(false);
    const [isBatchesDialogOpen, setBatchesDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<CourseWithStats | null>(null);

    async function handleTogglePublish(id: string, current: boolean) {
        try {
            await updateCourse(id, { isPublished: !current });
            toast.success(current ? "Course published" : "Course unpublished");
        } catch {
            toast.error("Failed to update course status");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this course? All modules, batches, and students will be lost.")) return;
        try {
            await deleteCourse(id);
            toast.success("Course deleted successfully");
        } catch {
            toast.error("Failed to delete course");
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => { setSelectedCourse(null); setCourseDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" /> New Course
                </Button>
            </div>

            {courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-muted/10 h-64">
                    <p className="text-muted-foreground">No courses available.</p>
                    <Button variant="outline" className="mt-4" onClick={() => { setSelectedCourse(null); setCourseDialogOpen(true); }}>
                        Create your first course
                    </Button>
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Image</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Stats</TableHead>
                                <TableHead>Published</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {courses.map((course) => (
                                <TableRow key={course.id}>
                                    <TableCell>
                                        <div className="w-12 h-12 rounded-md bg-muted overflow-hidden relative">
                                            {course.thumbnail ? (
                                                <Image 
                                                    src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.startsWith('http') ? '' : 'https://'}${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${course.thumbnail}`} 
                                                    alt={course.title} 
                                                    fill 
                                                    className="object-cover" 
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No img</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{course.title}</div>
                                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{course.description}</div>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div>{formatCurrency(Number(course.price))}</div>
                                        <div className="text-xs text-muted-foreground font-normal mt-1">{course.duration || "Self-paced"}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs"><span className="font-medium">{course._count.modules}</span> modules</div>
                                        <div className="text-xs"><span className="font-medium">{course.batches?.length || 0}</span> batches</div>
                                        <div className="text-xs"><span className="font-medium">{course._count.students}</span> students</div>
                                    </TableCell>
                                    <TableCell>
                                        <Switch 
                                            checked={course.isPublished} 
                                            onCheckedChange={() => handleTogglePublish(course.id, course.isPublished)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="icon" onClick={() => { setSelectedCourse(course); setBatchesDialogOpen(true); }} title="Manage Batches">
                                                <span className="text-xs font-semibold">B</span>
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => { setSelectedCourse(course); setModulesDialogOpen(true); }} title="Manage Modules">
                                                <LayoutList className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => { setSelectedCourse(course); setCourseDialogOpen(true); }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(course.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {isCourseDialogOpen && (
                <CourseDialog 
                    open={isCourseDialogOpen} 
                    onOpenChange={setCourseDialogOpen} 
                    course={selectedCourse} 
                />
            )}

            {isModulesDialogOpen && selectedCourse && (
                <ModulesDialog 
                    open={isModulesDialogOpen} 
                    onOpenChange={setModulesDialogOpen} 
                    course={selectedCourse} 
                />
            )}

            {isBatchesDialogOpen && selectedCourse && (
                <BatchesDialog 
                    open={isBatchesDialogOpen} 
                    onOpenChange={setBatchesDialogOpen} 
                    course={selectedCourse} 
                />
            )}
        </div>
    );
}
