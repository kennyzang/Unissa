// Create noor and zara student accounts
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createStudentAccounts() {
  try {
    const password = 'Demo@2026';
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create noor account
    const noor = await prisma.user.create({
      data: {
        username: 'noor',
        passwordHash: passwordHash,
        displayName: 'Noor Haji',
        role: 'student',
        email: 'noor@unissa.edu.bn',
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    
    // Create zara account
    const zara = await prisma.user.create({
      data: {
        username: 'zara',
        passwordHash: passwordHash,
        displayName: 'Zara Abdullah',
        role: 'student',
        email: 'zara@unissa.edu.bn',
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    
    console.log('Created noor account:', noor.username);
    console.log('Created zara account:', zara.username);
    console.log('Password: Demo@2026');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error creating student accounts:', error);
    await prisma.$disconnect();
  }
}

createStudentAccounts();