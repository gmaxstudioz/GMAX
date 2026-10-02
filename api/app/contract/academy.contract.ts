import { baseContract } from "./errors";
import { z } from "zod";

export const getPublicCoursesContract = baseContract.route({
    method: "GET",
    path: "/academy",
    summary: "Get published academy courses",
})
.output(z.object({
    items: z.array(z.any())
}));

export const getPublicCourseContract = baseContract.route({
    method: "GET",
    path: "/academy/{id}",
    summary: "Get a specific published course",
})
.input(z.object({
    id: z.string(),
}))
.output(z.any());

export const registerForCourseContract = baseContract.route({
    method: "POST",
    path: "/academy/register",
    summary: "Register and initialize payment for a course",
})
.input(z.object({
    courseId: z.string(),
    batchId: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string(),
    paymentPlan: z.enum(["QUARTER", "HALF", "FULL"]),
    howDidYouHear: z.string(),
}))
.output(z.object({
    reference: z.string(),
    amount: z.number(),
    email: z.string(),
    courseName: z.string(),
}));

export const verifyPaymentContract = baseContract.route({
    method: "GET",
    path: "/academy/verify",
    summary: "Verify an academy payment",
})
.input(z.object({
    reference: z.string(),
}))
.output(z.object({
    verified: z.boolean(),
}));
