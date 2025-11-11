/**
 * Prisma Client Initialization with Connection Pooling
 * Singleton pattern ensures single database connection across application
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prismaOptions: Prisma.PrismaClientOptions = {
  log:
    process.env.NODE_ENV === 'development'
      ? (['query', 'info', 'warn', 'error'] as Prisma.LogLevel[])
      : (['error'] as Prisma.LogLevel[]),
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

// Global singleton for hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Graceful shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('✅ Database connection closed');
}

/**
 * Health check
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

/**
 * Initialize database connection with retry logic
 */
export async function initializeDatabase(): Promise<void> {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');

      const healthy = await checkDatabaseHealth();
      if (healthy) {
        console.log('✅ Database health check passed');
        return;
      }
      throw new Error('Database health check failed');
    } catch (error) {
      console.error(`❌ Database connection attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) throw error;

      const delay = Math.min(1000 * 2 ** attempt, 10000);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

/**
 * Retry wrapper
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      console.warn(`Database operation failed (attempt ${i + 1}/${maxRetries}):`, err);
      await new Promise((r) => setTimeout(r, 100 * (i + 1)));
    }
  }
  throw lastError;
}

/**
 * Transaction wrapper
 */
type SafeTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>;

export async function executeTransaction<T>(
  callback: (tx: SafeTx) => Promise<T>
): Promise<T> {
  try {
    return await prisma.$transaction(async (tx) => callback(tx as SafeTx), {
      maxWait: 5000,
      timeout: 10000,
    });
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

export default prisma;

// // src/config/database.ts
// /**
//  * Prisma Client Initialization with Connection Pooling
//  * Singleton pattern ensures single database connection across application
//  */

// import { Prisma, PrismaClient } from '@prisma/client';

// // Enable query logging in development
// const prismaOptions: Prisma.PrismaClientOptions = {
//   log:
//     process.env.NODE_ENV === 'development'
//       ? (['query', 'info', 'warn', 'error'] as Prisma.LogLevel[])
//       : (['error'] as Prisma.LogLevel[]),

//   datasources: {
//     db: { url: process.env.DATABASE_URL },
//   },
// };

// // Global singleton to prevent multiple instances in development hot-reload
// declare global {
//   var prisma: PrismaClient | undefined;
// }

// export const prisma = global.prisma || new PrismaClient(prismaOptions);

// if (process.env.NODE_ENV !== 'production') {
//   global.prisma = prisma;
// }

// /**
//  * Graceful database connection shutdown
//  */
// export async function disconnectDatabase(): Promise<void> {
//   await prisma.$disconnect();
//   console.log('✅ Database connection closed');
// }

// /**
//  * Database health check
//  */
// export async function checkDatabaseHealth(): Promise<boolean> {
//   try {
//     await prisma.$queryRaw`SELECT 1`;
//     return true;
//   } catch (error) {
//     console.error('❌ Database health check failed:', error);
//     return false;
//   }
// }

// /**
//  * Initialize database connection with retry logic
//  */
// export async function initializeDatabase(): Promise<void> {
//   const maxRetries = 5;
//   let retries = 0;
  
//   while (retries < maxRetries) {
//     try {
//       await prisma.$connect();
//       console.log('✅ Database connected successfully');
      
//       // Verify connection health
//       const isHealthy = await checkDatabaseHealth();
//       if (isHealthy) {
//         console.log('✅ Database health check passed');
//         return;
//       }
      
//       throw new Error('Database health check failed');
//     } catch (error) {
//       retries++;
//       console.error(`❌ Database connection attempt ${retries}/${maxRetries} failed:`, error);
      
//       if (retries >= maxRetries) {
//         throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
//       }
      
//       // Exponential backoff
//       const delay = Math.min(1000 * Math.pow(2, retries), 10000);
//       console.log(`⏳ Retrying in ${delay}ms...`);
//       await new Promise(resolve => setTimeout(resolve, delay));
//     }
//   }
// }

// /**
//  * Execute database operations with automatic retry
//  */
// export async function withRetry<T>(
//   operation: () => Promise<T>,
//   maxRetries: number = 3
// ): Promise<T> {
//   let lastError: Error;
  
//   for (let i = 0; i < maxRetries; i++) {
//     try {
//       return await operation();
//     } catch (error) {
//       lastError = error as Error;
//       console.warn(`Database operation failed (attempt ${i + 1}/${maxRetries}):`, error);
      
//       if (i < maxRetries - 1) {
//         await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
//       }
//     }
//   }
  
//   throw lastError!;
// }

// /**
//  * Transaction wrapper with proper error handling
//  */
// export async function executeTransaction<T>(
//   callback: (tx: PrismaClient) => Promise<T>
// ): Promise<T> {
//   try {
//     return await prisma.$transaction(async (tx) => {
//       return callback(tx);
//     }, {
//       maxWait: 5000,
//       timeout: 10000,
//     });
//   } catch (error) {
//     console.error('Transaction failed:', error);
//     throw error;
//   }
// }


// export default prisma;