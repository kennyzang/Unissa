// Check Noor's status in detail
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkNoorStatus() {
  try {
    // Check Noor's user account
    const noorUser = await prisma.user.findUnique({
      where: { username: 'noor' },
      include: {
        student: true
      }
    });
    
    console.log('Noor user account:');
    console.log(JSON.stringify(noorUser, null, 2));
    
    // Check Noor's applicant record
    const noorApplicant = await prisma.applicant.findFirst({
      where: {
        userId: noorUser.id
      }
    });
    
    console.log('\nNoor applicant record:');
    console.log(JSON.stringify(noorApplicant, null, 2));
    
    // Check if there are any applicants with status 'offered'
    const offeredApplicants = await prisma.applicant.findMany({
      where: {
        status: 'offered'
      }
    });
    
    console.log('\nOffered applicants:', offeredApplicants.length);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking Noor status:', error);
    await prisma.$disconnect();
  }
}

checkNoorStatus();