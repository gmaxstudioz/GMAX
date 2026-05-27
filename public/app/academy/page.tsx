"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { getPublicCourses } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { BookOpen, Calendar, Loader2 } from "lucide-react";

interface CourseData {
    id: string;
    title: string;
    description: string;
    price: number | string;
    duration?: string;
    location?: string;
    thumbnail?: string;
    modules?: Record<string, unknown>[];
}

export default function AcademyPage() {
    const [courses, setCourses] = useState<CourseData[]>([]);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchCourses() {
            try {
                const res = await getPublicCourses();
                setCourses(res.items);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchCourses();
    }, []);

    useEffect(() => {
        if (!containerRef.current || loading) return;
        const items = containerRef.current.querySelectorAll(".course-card");
        if (items.length === 0) return;
        gsap.fromTo(
            items,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power2.out" }
        );
    }, [loading, courses]);

    return (
        <main className="min-h-screen pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto">
            <div className="max-w-2xl mb-16">
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
                    GMAX <span className="text-neutral-500">Academy</span>
                </h1>
                <p className="text-xl text-neutral-400">
                    Master the art of photography and studio management. Join our expert-led courses and elevate your skills.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
                </div>
            ) : courses.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-neutral-800 rounded-2xl">
                    <p className="text-neutral-500">No courses available at the moment. Check back soon!</p>
                </div>
            ) : (
                <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                    {courses.map(course => (
                        <Link key={course.id} href={`/academy/${course.id}`} className="course-card group block">
                            <div className="bg-primary/20 border border-primary/30 rounded-2xl overflow-hidden hover:border-primary/60 transition-colors">
                                <div className="aspect-video bg-primary/10 relative overflow-hidden">
                                    {course.thumbnail ? (
                                        <Image 
                                            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.startsWith('http') ? '' : 'https://'}${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${course.thumbnail}`} 
                                            alt={course.title} 
                                            fill 
                                            className="object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <BookOpen className="w-16 h-16 opacity-50 text-primary" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-8">
                                    <div className="flex justify-between items-start mb-4">
                                        <h2 className="text-2xl md:text-3xl font-semibold line-clamp-2 pr-4 text-foreground">{course.title}</h2>
                                        <span className="text-primary-foreground font-medium bg-primary px-4 py-2 rounded-full text-base whitespace-nowrap">
                                            {formatCurrency(Number(course.price))}
                                        </span>
                                    </div>
                                    <p className="text-foreground/80 text-base md:text-lg line-clamp-2 mb-8">
                                        {course.description}
                                    </p>
                                    <div className="flex items-center justify-between text-base text-primary/80 font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-5 h-5" />
                                            <span>{course.duration || "Self-paced"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="w-5 h-5" />
                                            <span>{course.modules?.length || 0} Modules</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}
