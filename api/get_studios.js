const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.studio.findMany().then(res => { console.log(JSON.stringify(res, null, 2)); prisma.$disconnect(); });
