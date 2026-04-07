// Check Zara's actual status in database
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkZaraActualStatus() {
  try {
    // Check Zara's user account
    const zaraUser = await prisma.user.findUnique({
      where: { username: 'zara' },
      include: {
        student: true
      }
    });
    
    console.log('Zara user account:');
    console.log(JSON.stringify(zaraUser, null, 2));
    
    // Check Zara's applicant record
    const zaraApplicant = await prisma.applicant.findFirst({
      where: {
        userId: zaraUser.id
      }
    });
    
    console.log('\nZara applicant record:');
    console.log(JSON.stringify(zaraApplicant, null, 2));
    
    // Check Noor's status
    const noorUser = await prisma.user.findUnique({
      where: { username: 'noor' },
      include: {
        student: true
      }
    });
    
    console.log('\nNoor user account:');
    console.log(JSON.stringify(noorUser, null, 2));
    
    // Check Noor's applicant record
    const noorApplicant = await prisma.applicant.findFirst({
      where: {
        userId: noorUser.id
      }
    });
    
    console.log('\nNoor applicant record:');
    console.log(JSON.stringify(noorApplicant, null, 2));
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking Zara status:', error);
    await prisma.$disconnect();
  }
}

checkZaraActualStatus();