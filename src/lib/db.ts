import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Logs verbeux (prisma:query) uniquement sur opt-in explicite :
    // PRISMA_LOG_QUERIES=1. Défaut silencieux (error seuls), y compris en dev.
    log:
      process.env.PRISMA_LOG_QUERIES === "1"
        ? ["query", "error"]
        : ["error"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db