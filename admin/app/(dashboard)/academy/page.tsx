import { Metadata } from "next";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq } from "drizzle-orm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcademyCoursesTable } from "./_components/AcademyCoursesTable";
import { AcademyStudentsTable } from "./_components/AcademyStudentsTable";
import { BookOpen, Users, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
    title: "Academy",
    description: "Manage your Academy courses, modules, and students.",
};

export default async function AcademyPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const members = await db.query.member.findMany({
        where: eq(schema.member.userId, session.user.id),
        columns: { role: true }
    });
    
    const adminRoles = ["owner", "developer"];
    const hasAdminRole = members.some((m: any) => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) {
        redirect("/my-tasks");
    }

    // Fetch courses with their module count and student count
    const drizzleCourses = await db.query.academyCourse.findMany({
        with: {
            academyModules: {
                orderBy: (modules, { asc }) => [asc(modules.sortOrder)]
            },
            academyBatches: {
                orderBy: (batches, { asc }) => [asc(batches.startDate)]
            },
            academyStudents: true
        },
        orderBy: (courses, { desc }) => [desc(courses.createdAt)],
    });

    const courses = drizzleCourses.map((c: any) => ({
        ...c,
        modules: c.academyModules,
        batches: c.academyBatches,
        _count: {
            modules: c.academyModules?.length || 0,
            students: c.academyStudents?.length || 0
        }
    }));

    const studentsRaw = await db.query.academyStudent.findMany({
        with: { academyCourse: true, academyBatch: true },
        orderBy: (students, { desc }) => [desc(students.createdAt)],
    });

    const students = studentsRaw.map((s: any) => ({
        ...s,
        course: s.academyCourse,
        batch: s.academyBatch
    }));

    // Calculate metrics
    const totalStudents = students.filter((s: any) => s.paymentStatus === "SUCCESS").length;
    const totalRevenue = students
        .filter((s: any) => s.paymentStatus === "SUCCESS")
        .reduce((sum: any, s: any) => sum + Number(s.amountPaid), 0);

    return (
        <div className="space-y-6 md:py-6 px-4 lg:px-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Academy</h1>
                <p className="text-muted-foreground">
                    Manage your courses, curriculum, and students.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{courses.filter((c: any) => c.isPublished).length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {courses.length} total courses
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Enrolled Students</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalStudents}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Paid enrollments
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="courses" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="courses">Courses & Modules</TabsTrigger>
                    <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="courses" className="space-y-4">
                    <AcademyCoursesTable courses={courses.map((c: any) => ({...c, price: Number(c.price)}))} />
                </TabsContent>
                <TabsContent value="students" className="space-y-4">
                    <AcademyStudentsTable students={students.map((s: any) => ({...s, amountPaid: Number(s.amountPaid), course: { ...s.course, price: Number(s.course?.price) }}))} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
