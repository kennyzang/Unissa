// Check if admin user exists
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: 'admin'
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
    
    console.log('Admin users found:', users.length);
    console.log('Admin users:', users);
    
    // Also check if any user exists
    const allUsers = await prisma.user.count();
    console.log('Total users in database:', allUsers);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking admin user:', error);
    await prisma.$disconnect();
  }
}

checkAdminUser();