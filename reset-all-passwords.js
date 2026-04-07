// Reset all users' passwords to Demo@2026
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetAllPasswords() {
  try {
    const newPassword = 'Demo@2026';
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    const result = await prisma.user.updateMany({
      data: {
        passwordHash: passwordHash,
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    
    console.log(`Successfully reset passwords for ${result.count} users`);
    console.log('New password: Demo@2026');
    
    // Verify the reset by checking a few users
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        username: true,
        role: true
      }
    });
    
    console.log('Sample users updated:', users);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error resetting passwords:', error);
    await prisma.$disconnect();
  }
}

resetAllPasswords();