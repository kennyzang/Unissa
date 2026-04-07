// Reset admin password
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    const newPassword = 'password123';
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    const user = await prisma.user.update({
      where: {
        username: 'admin'
      },
      data: {
        passwordHash: passwordHash,
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    
    console.log('Admin password reset successfully');
    console.log('New password: password123');
    console.log('Updated user:', user.username);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error resetting admin password:', error);
    await prisma.$disconnect();
  }
}

resetAdminPassword();