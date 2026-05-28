"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { getPublicCourse } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, BookOpen, Calendar, Loader2 } from "lucide-react";
import Link from "next/link";
import { CourseSignupForm } from "./_components/CourseSignupForm";
import { Card, CardContent } from "@/components/ui/card";

interface CourseModule {
    id: string;
    title: string;
    description: string | null;
}

interface CourseData {
    id: string;
    title: string;
    description: string;
    price: number | string;
    duration?: string;
    location?: string;
    thumbnail?: string;
    modules?: CourseModule[];
    batches?: {
        id: string;
        name: string;
        startDate: string | Date;
        endDate: string | Date;
    }[];
}

export default function CoursePage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [course, setCourse] = useState<CourseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCourse() {
            try {
                const res = await getPublicCourse(courseId);
                setCourse(res as CourseData);
            } catch {
                setError("Course not found or unavailable.");
            } finally {
                setLoading(false);
            }
        }
        fetchCourse();
    }, [courseId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
            </div>
        );
    }

    if (error || !course) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center pt-32 pb-24 px-6 text-center">
                <p className="text-xl text-neutral-400 mb-6">{error}</p>
                <Link href="/academy" className="text-white hover:underline flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Academy
                </Link>
            </div>
        );
    }

    return (
        <main className="min-h-screen pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto">
            <Link href="/academy" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-8 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Courses
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-7 space-y-10">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">{course.title}</h1>
                        <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {course.description}
                        </p>
                    </div>

                    <Card className="bg-card text-card-foreground border-border shadow-sm py-0">
                        <CardContent className="flex flex-wrap gap-6 p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-muted rounded-lg">
                                    <Calendar className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Duration</p>
                                    <p className="font-medium">
                                        {course.duration || "Self-paced"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-muted rounded-lg">
                                    <BookOpen className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Modules</p>
                                    <p className="font-medium">{course.modules?.length || 0}</p>
                                </div>
                            </div>
                            {course.location && (
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-muted rounded-lg">
                                        <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Location</p>
                                        <p className="font-medium">{course.location}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {course.modules && course.modules.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">What you will learn</h2>
                            <div className="space-y-4">
                                {course.modules.map((mod: CourseModule, idx: number) => (
                                    <Card key={mod.id} className="bg-card border-border shadow-sm py-0 rounded-xl">
                                        <CardContent className="p-5 flex gap-4">
                                            <div className="text-2xl font-bold text-muted-foreground w-8">{idx + 1}</div>
                                            <div>
                                                <h3 className="text-lg font-medium text-foreground mb-1">{mod.title}</h3>
                                                {mod.description && (
                                                    <p className="text-sm text-muted-foreground">{mod.description}</p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-5">
                    <div className="sticky top-32">
                        <Card className="overflow-hidden border-border bg-card shadow-lg py-0">
                            <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                                {course.thumbnail ? (
                                    <Image 
                                        src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.startsWith('http') ? '' : 'https://'}${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${course.thumbnail}`} 
                                        alt={course.title} 
                                        fill 
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                        <BookOpen className="w-16 h-16 opacity-50" />
                                    </div>
                                )}
                            </div>
                            <CardContent className="p-6 lg:p-8 pt-6">
                                <div className="flex items-end gap-2 mb-8 border-b border-border pb-6">
                                    <span className="text-4xl font-bold text-foreground tracking-tight">
                                        {formatCurrency(Number(course.price))}
                                    </span>
                                </div>
                                
                                <CourseSignupForm course={course} />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </main>
    );
}
