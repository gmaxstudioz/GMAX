
import { prisma } from "@/lib/prisma";
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
        const courses = await prisma.academyCourse.findMany({
            where: { isPublished: true },
            include: {
                modules: {
                    orderBy: { sortOrder: "asc" },
                },
                batches: {
                    orderBy: { startDate: "asc" },
                }
            },
            orderBy: { createdAt: "desc" },
        });

        return { items: courses };
    });

export const getPublicCourse = os.academy.getPublicCourse
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const course = await prisma.academyCourse.findUnique({
            where: { id: input.id, isPublished: true },
            include: {
                modules: {
                    orderBy: { sortOrder: "asc" },
                },
                batches: {
                    orderBy: { startDate: "asc" },
                }
            },
        });

        if (!course) {
            throw errors.NOT_FOUND({ 
                message: "Course not found",
                data: { resourceType: "Course", resourceId: input.id }
            });
        }

        return course;
    });

export const registerForCourse = os.academy.register
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const course = await prisma.academyCourse.findUnique({
            where: { id: input.courseId, isPublished: true },
        });

        if (!course) {
            throw errors.NOT_FOUND({ 
                message: "Course not found",
                data: { resourceType: "Course", resourceId: input.courseId }
            });
        }

        const existing = await prisma.academyStudent.findFirst({
            where: {
                courseId: course.id,
                email: input.email,
                paymentStatus: "SUCCESS",
            }
        });

        if (existing) {
            throw errors.BAD_REQUEST({ message: "You have already registered for this course." });
        }

        let amountToPay = Number(course.price);
        if (input.paymentPlan === "QUARTER") amountToPay = amountToPay * 0.25;
        if (input.paymentPlan === "HALF") amountToPay = amountToPay * 0.50;

        const reference = `gmax-academy-${uuidv4().slice(0, 8)}`;
        
        const registration = await prisma.academyStudent.create({
            data: {
                courseId: course.id,
                batchId: input.batchId,
                firstName: input.firstName,
                lastName: input.lastName,
                email: input.email,
                phone: input.phone,
                amountPaid: amountToPay,
                paymentPlan: input.paymentPlan,
                howDidYouHear: input.howDidYouHear,
                paymentReference: reference,
                paymentStatus: "PENDING",
            }
        });

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
        const registration = await prisma.academyStudent.findUnique({
            where: { paymentReference: input.reference },
            include: { course: true, batch: true },
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
                await prisma.academyStudent.update({
                    where: { id: registration.id },
                    data: { paymentStatus: "SUCCESS" },
                });

                const startDateStr = registration.batch?.startDate 
                    ? new Date(registration.batch.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : "a date to be announced";

                await sendAcademyRegistrationEmail({
                    email: registration.email,
                    studentName: registration.firstName,
                    courseName: registration.course.title,
                    startDate: startDateStr,
                    amountPaid: formatCurrency(Number(registration.amountPaid)),
                }).catch(err => console.error("Academy Email failed:", err));

                if (registration.phone) {
                    await sendAcademyRegistrationSMS({
                        phone: registration.phone,
                        courseName: registration.course.title,
                        startDate: startDateStr,
                    }).catch(err => console.error("Academy SMS failed:", err));
                    
                    await sendAcademyRegistrationWhatsApp({
                        phone: registration.phone,
                        courseName: registration.course.title,
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
