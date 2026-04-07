// Check Zara's current status
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkZaraStatus() {
  try {
    // Check user account
    const user = await prisma.user.findUnique({
      where: { username: 'zara' },
      include: {
        student: true
      }
    });
    
    console.log('Zara user account:', user);
    
    // Check applicant record
    const applicant = await prisma.applicant.findFirst({
      where: {
        OR: [
          { userId: user?.id },
          { email: 'zara@unissa.edu.bn' }
        ]
      }
    });
    
    console.log('Zara applicant record:', applicant);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking Zara status:', error);
    await prisma.$disconnect();
  }
}

checkZaraStatus();