// Check password hash and verify
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkPassword() {
  try {
    const user = await prisma.user.findUnique({
      where: {
        username: 'admin'
      }
    });
    
    if (user) {
      console.log('User found:', user.username);
      console.log('Password hash:', user.passwordHash);
      
      // Test password verification
      const testPasswords = ['password123', 'admin123', 'password', '123456'];
      
      for (const password of testPasswords) {
        const isValid = await bcrypt.compare(password, user.passwordHash);
        console.log(`Password '${password}': ${isValid ? 'VALID' : 'INVALID'}`);
      }
    } else {
      console.log('User not found');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking password:', error);
    await prisma.$disconnect();
  }
}

checkPassword();