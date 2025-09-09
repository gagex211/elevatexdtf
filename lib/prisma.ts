export const prisma = {
  order: {
    upsert: async (args:any)=>({ id:"no-db", ...(args?.create||{}), createdAt:new Date(), updatedAt:new Date() }),
    findMany: async ()=>[],
    findUnique: async ()=>null,
    update: async (args:any)=>({ id: args?.where?.id || "no-db", ...(args?.data||{}), createdAt:new Date(), updatedAt:new Date() }),
  },
} as any;
