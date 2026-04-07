// Create Zara's admission application record
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createZaraApplication() {
  try {
    // Find Zara's user account
    const zaraUser = await prisma.user.findUnique({
      where: { username: 'zara' }
    });
    
    if (!zaraUser) {
      console.log('Zara user not found');
      await prisma.$disconnect();
      return;
    }
    
    // Create academic year if not exists
    const academicYear = await prisma.academicYear.upsert({
      where: { year: 2026 },
      update: {},
      create: {
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        isCurrent: true
      }
    });
    
    console.log('Academic year created/updated:', academicYear.id);
    
    // Create semester if not exists
    const semester = await prisma.semester.upsert({
      where: { academicYearId_semesterNumber: { academicYearId: academicYear.id, semesterNumber: 1 } },
      update: {},
      create: {
        academicYearId: academicYear.id,
        name: 'Semester 1 2026',
        semesterNumber: 1,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-05-31'),
        addDropEnd: new Date('2026-01-15'),
        isActive: true
      }
    });
    
    console.log('Semester created/updated:', semester.id);
    
    // Create department if not exists
    const department = await prisma.department.upsert({
      where: { code: 'CS' },
      update: {},
      create: {
        code: 'CS',
        name: 'Computer Science',
        isActive: true
      }
    });
    
    console.log('Department created/updated:', department.id);
    
    // Create programme if not exists
    const programme = await prisma.programme.upsert({
      where: { code: 'CS101' },
      update: {},
      create: {
        code: 'CS101',
        name: 'Bachelor of Computer Science',
        departmentId: department.id,
        level: 'degree',
        durationYears: 4,
        feeLocalPerCh: 1000,
        feeInternationalPerCh: 2000,
        isActive: true
      }
    });
    
    console.log('Programme created/updated:', programme.id);
    
    // Create intake if not exists
    const intake = await prisma.intake.upsert({
      where: { programmeId_semesterId: { programmeId: programme.id, semesterId: semester.id } },
      update: {},
      create: {
        programmeId: programme.id,
        semesterId: semester.id,
        intakeStart: new Date('2026-01-01'),
        intakeEnd: new Date('2026-02-29'),
        isOpen: true,
        maxCapacity: 100
      }
    });
    
    console.log('Intake created/updated:', intake.id);
    
    // Create applicant record for Zara
    const applicant = await prisma.applicant.create({
      data: {
        userId: zaraUser.id,
        applicationRef: `APP-${Date.now()}`,
        fullName: 'Zara Abdullah',
        icPassport: '1234567890',
        dateOfBirth: new Date('2000-01-01'),
        gender: 'female',
        nationality: 'Brunei Darussalam',
        email: 'zara@unissa.edu.bn',
        mobile: '8888888',
        homeAddress: '123 Main Street, Bandar Seri Begawan',
        highestQualification: 'A Level',
        previousInstitution: 'Sultan Omar Ali Saifuddien College',
        yearOfCompletion: 2025,
        cgpa: 3.5,
        intakeId: intake.id,
        programmeId: programme.id,
        modeOfStudy: 'full_time',
        scholarshipApplied: false,
        status: 'submitted',
        submittedAt: new Date(),
        accountCreated: true
      }
    });
    
    console.log('Created applicant record for Zara:', applicant.id);
    console.log('Zara is now at admission application stage');
    
    // Verify the creation
    const createdApplicant = await prisma.applicant.findFirst({
      where: { userId: zaraUser.id }
    });
    
    console.log('Verified applicant record:', createdApplicant);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error creating Zara application:', error);
    await prisma.$disconnect();
  }
}

createZaraApplication();