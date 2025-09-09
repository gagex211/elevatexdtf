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
        upsert: async () => ({ id: "stub", email: "", sheetWidth: 0, sheetHeight: 0, dpi: 0, sqFt: 0, unitPrice: 0, amount: 0, s3Key: "", stripeId: "stub", status: "NEW" }),
        update: async () => ({})
      }
    };
