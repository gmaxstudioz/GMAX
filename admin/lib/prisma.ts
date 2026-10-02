import { db } from "./db";

// Mocking Prisma so that UI components and unmigrated files can compile
export const prisma: any = db;
