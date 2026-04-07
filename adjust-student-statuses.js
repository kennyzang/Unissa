// Adjust student statuses: Noor to offered, Zara to not submitted
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function adjustStudentStatuses() {
  try {
    console.log('=== Adjusting student statuses ===');
    
    // 1. Get existing data
    const academicYear = await prisma.academicYear.findFirst({ where: { year: 2026 } });
    const semester = await prisma.semester.findFirst({ 
      where: { 
        academicYearId: academicYear.id, 
        semesterNumber: 1 
      } 
    });
    const department = await prisma.department.findFirst({ where: { code: 'CS' } });
    const programme = await prisma.programme.findFirst({ where: { code: 'CS101' } });
    const intake = await prisma.intake.findFirst({ 
      where: { 
        programmeId: programme.id, 
        semesterId: semester.id 
      } 
    });
    
    // 2. Get user accounts
    const noorUser = await prisma.user.findUnique({ where: { username: 'noor' } });
    const zaraUser = await prisma.user.findUnique({ where: { username: 'zara' } });
    
    console.log('Found Noor user:', noorUser.username);
    console.log('Found Zara user:', zaraUser.username);
    
    // 3. Handle Zara: Remove existing application (if any)
    const existingZaraApp = await prisma.applicant.findFirst({ where: { userId: zaraUser.id } });
    if (existingZaraApp) {
      await prisma.applicant.delete({ where: { id: existingZaraApp.id } });
      console.log('Removed Zara\'s existing application');
    }
    
    // 4. Handle Noor: Create or update application to offered status
    let noorApp = await prisma.applicant.findFirst({ where: { userId: noorUser.id } });
    
    if (!noorApp) {
      // Create new application for Noor
      noorApp = await prisma.applicant.create({
        data: {
          userId: noorUser.id,
          applicationRef: `APP-${Date.now()}`,
          fullName: 'Noor Haji',
          icPassport: '0987654321',
          dateOfBirth: new Date('2000-01-01'),
          gender: 'female',
          nationality: 'Brunei Darussalam',
          email: 'noor@unissa.edu.bn',
          mobile: '7777777',
          homeAddress: '456 Main Street, Bandar Seri Begawan',
          highestQualification: 'A Level',
          previousInstitution: 'Sultan Omar Ali Saifuddien College',
          yearOfCompletion: 2025,
          cgpa: 3.8,
          intakeId: intake.id,
          programmeId: programme.id,
          modeOfStudy: 'full_time',
          scholarshipApplied: false,
          status: 'offered',
          submittedAt: new Date(),
          decisionMadeAt: new Date(),
          offerRef: `OFFER-${Date.now()}`,
          accountCreated: true
        }
      });
      console.log('Created Noor\'s application with offered status');
    } else {
      // Update existing application to offered status
      noorApp = await prisma.applicant.update({
        where: { id: noorApp.id },
        data: {
          status: 'offered',
          decisionMadeAt: new Date(),
          offerRef: `OFFER-${Date.now()}`
        }
      });
      console.log('Updated Noor\'s application to offered status');
    }
    
    // 5. Verify the changes
    console.log('\n=== Verification ===');
    
    const updatedNoorApp = await prisma.applicant.findFirst({ where: { userId: noorUser.id } });
    console.log('Noor\'s application status:', updatedNoorApp?.status);
    console.log('Noor\'s offer reference:', updatedNoorApp?.offerRef);
    
    const updatedZaraApp = await prisma.applicant.findFirst({ where: { userId: zaraUser.id } });
    console.log('Zara\'s application status:', updatedZaraApp ? updatedZaraApp.status : 'No application (expected)');
    
    console.log('\n=== Status adjustment completed ===');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error adjusting student statuses:', error);
    await prisma.$disconnect();
  }
}

adjustStudentStatuses();