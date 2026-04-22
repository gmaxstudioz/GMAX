import z from "zod";

export const registerSchema = z.object({
    name: z.string().min(3, {message: "Name must be at least 3 characters long"}).max(50, {message: "Name must be at most 50 characters long"}),
    email: z.email(),
    password: z.string().min(8, {message: "Password must be at least 8 characters long"}).max(32, {message: "Password must be at most 32 characters long"}),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
});

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(8, {message: "Password must be at least 8 characters long"}).max(32, {message: "Password must be at most 32 characters long"})
});

export const forgotPasswordSchema = z.object({
    email: z.email(),
});

export const resetPasswordSchema = z.object({
    password: z.string().min(8, {message: "Password must be at least 8 characters long"}).max(32, {message: "Password must be at most 32 characters long"}),
    confirmPassword: z.string().min(8, {message: "Password must be at least 8 characters long"}).max(32, {message: "Password must be at most 32 characters long"})
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
});