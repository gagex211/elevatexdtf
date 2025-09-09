/** Safe prisma: works even if @prisma/client wasn’t generated yet */
let PrismaClient: any;
try { PrismaClient = require("@prisma/client").PrismaClient; } catch {}

const g = global as any;
export const prisma: any = PrismaClient
  ? (g.prisma ||= new PrismaClient())
  : {
      order: {
        findMany: async () => [],
        findUnique: async () => null,
        upsert: async () => ({ id: "stub" }),
        update: async () => ({})
      }
    };
