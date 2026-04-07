// Check noor and zara student accounts
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkStudentAccounts() {
  try {
    const usernames = ['noor', 'zara'];
    
    for (const username of usernames) {
      const user = await prisma.user.findUnique({
        where: {
          username: username
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true,
          failedLoginCount: true,
          lockedUntil: true
        }
      });
      
      if (user) {
        console.log(`User ${username} found:`);
        console.log(user);
      } else {
        console.log(`User ${username} not found`);
      }
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking student accounts:', error);
    await prisma.$disconnect();
  }
}

checkStudentAccounts();