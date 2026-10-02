"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

type StudentWithCourse = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    amountPaid: number | string;
    paymentPlan: string;
    howDidYouHear: string;
    paymentReference: string | null;
    paymentStatus: string;
    createdAt: Date;
    course: {
        title: string;
    };
    batch: {
        name: string;
    }
};

export function AcademyStudentsTable({ students }: { students: StudentWithCourse[] }) {
    if (students.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-muted/10 h-64">
                <p className="text-muted-foreground">No students have enrolled yet.</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Course & Batch</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {students.map((student) => (
                        <TableRow key={student.id}>
                            <TableCell>
                                <div className="font-medium">{student.firstName} {student.lastName}</div>
                                {student.howDidYouHear && (
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                        Source: {student.howDidYouHear}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="text-sm">{student.email}</div>
                                <div className="text-xs text-muted-foreground">{student.phone}</div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm font-medium">{student.course.title}</div>
                                <div className="text-xs text-muted-foreground">{student.batch.name}</div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm font-medium">{formatCurrency(Number(student.amountPaid))}</div>
                                <Badge variant={student.paymentStatus === "SUCCESS" ? "default" : "secondary"} className="mt-1 text-[10px]">
                                    {student.paymentStatus}
                                </Badge>
                                <div className="text-[10px] text-muted-foreground mt-1">
                                    Plan: {student.paymentPlan}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm">{format(new Date(student.createdAt), "MMM d, yyyy")}</div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
