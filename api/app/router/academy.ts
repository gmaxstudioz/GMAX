import { db } from "@/lib/db";
import { academyCourse, academyStudent } from "@/lib/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { optionalAuthMiddleware, BaseContext } from "./middleware";
import { v4 as uuidv4 } from "uuid";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { paystackFetch } from "@/lib/paystack";
import { sendAcademyRegistrationEmail, sendAcademyRegistrationSMS, sendAcademyRegistrationWhatsApp } from "@/lib/termii";

const os = implement(contract).$context<BaseContext>();

function formatCurrency(amount: number | string): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(num);
}

export const getPublicCourses = os.academy.getPublicCourses
    .use(optionalAuthMiddleware)
    .handler(async () => {
        const courses = await db.query.academyCourse.findMany({
            where: eq(academyCourse.isPublished, true),
            with: {
                academyModules: {
                    orderBy: (modules, { asc }) => [asc(modules.sortOrder)],
                },
                academyBatches: {
                    orderBy: (batches, { asc }) => [asc(batches.startDate)],
                }
            },
            orderBy: (courses, { desc }) => [desc(courses.createdAt)],
        });

        return { items: courses as any };
    });

export const getPublicCourse = os.academy.getPublicCourse
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const course = await db.query.academyCourse.findFirst({
            where: and(eq(academyCourse.id, input.id), eq(academyCourse.isPublished, true)),
            with: {
                academyModules: {
                    orderBy: (modules, { asc }) => [asc(modules.sortOrder)],
                },
                academyBatches: {
                    orderBy: (batches, { asc }) => [asc(batches.startDate)],
                }
            },
        });

        if (!course) {
            throw errors.NOT_FOUND({ 
                message: "Course not found",
                data: { resourceType: "Course", resourceId: input.id }
            });
        }

        return course as any;
    });

export const registerForCourse = os.academy.register
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const course = await db.query.academyCourse.findFirst({
            where: and(eq(academyCourse.id, input.courseId), eq(academyCourse.isPublished, true)),
        });

        if (!course) {
            throw errors.NOT_FOUND({ 
                message: "Course not found",
                data: { resourceType: "Course", resourceId: input.courseId }
            });
        }

        const existing = await db.query.academyStudent.findFirst({
            where: and(
                eq(academyStudent.courseId, course.id),
                eq(academyStudent.email, input.email),
                eq(academyStudent.paymentStatus, "SUCCESS")
            )
        });

        if (existing) {
            throw errors.BAD_REQUEST({ message: "You have already registered for this course." });
        }

        let amountToPay = Number(course.price);
        if (input.paymentPlan === "QUARTER") amountToPay = amountToPay * 0.25;
        if (input.paymentPlan === "HALF") amountToPay = amountToPay * 0.50;

        const reference = `gmax-academy-${uuidv4().slice(0, 8)}`;
        
        const [registration] = await db.insert(academyStudent).values({
            id: uuidv4(),
            courseId: course.id,
            batchId: input.batchId,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            amountPaid: amountToPay.toString(),
            paymentPlan: input.paymentPlan as "FULL" | "HALF" | "QUARTER",
            howDidYouHear: input.howDidYouHear,
            paymentReference: reference,
            paymentStatus: "PENDING",
        }).returning();

        return {
            reference: registration.paymentReference as string,
            amount: amountToPay,
            email: registration.email,
            courseName: course.title,
        };
    });

export const verifyPayment = os.academy.verifyPayment
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const registration = await db.query.academyStudent.findFirst({
            where: eq(academyStudent.paymentReference, input.reference),
            with: { academyCourse: true, academyBatch: true },
        });

        if (!registration) {
            return { verified: false };
        }

        if (registration.paymentStatus === "SUCCESS") {
            return { verified: true };
        }

        try {
            const response = await paystackFetch<{ data?: { status?: string } }>(`/transaction/verify/${input.reference}`);
            
            if (response.data?.status === "success") {
                await db.update(academyStudent)
                    .set({ paymentStatus: "SUCCESS", updatedAt: new Date().toISOString() })
                    .where(eq(academyStudent.id, registration.id));

                const startDateStr = registration.academyBatch?.startDate 
                    ? new Date(registration.academyBatch.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : "a date to be announced";

                await sendAcademyRegistrationEmail({
                    email: registration.email,
                    studentName: registration.firstName,
                    courseName: registration.academyCourse.title,
                    startDate: startDateStr,
                    amountPaid: formatCurrency(Number(registration.amountPaid)),
                }).catch(err => console.error("Academy Email failed:", err));

                if (registration.phone) {
                    await sendAcademyRegistrationSMS({
                        phone: registration.phone,
                        courseName: registration.academyCourse.title,
                        startDate: startDateStr,
                    }).catch(err => console.error("Academy SMS failed:", err));
                    
                    await sendAcademyRegistrationWhatsApp({
                        phone: registration.phone,
                        courseName: registration.academyCourse.title,
                        startDate: startDateStr,
                    }).catch(err => console.error("Academy WhatsApp failed:", err));
                }

                return { verified: true };
            }
        } catch (error) {
            console.error("Failed to verify academy payment", error);
        }

        return { verified: false };
    });
