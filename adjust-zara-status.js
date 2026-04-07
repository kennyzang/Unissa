// Adjust Zara's status to admission application stage
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function adjustZaraStatus() {
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
    
    // Check if there's an existing intake and programme
    const intake = await prisma.intake.findFirst();
    const programme = await prisma.programme.findFirst();
    
    if (!intake || !programme) {
      console.log('No intake or programme found. Creating test data...');
      
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
      
      // Create programme if not exists
      const newProgramme = await prisma.programme.upsert({
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
      
      // Create intake if not exists
      const newIntake = await prisma.intake.upsert({
        where: { programmeId_semesterId: { programmeId: newProgramme.id, semesterId: semester.id } },
        update: {},
        create: {
          programmeId: newProgramme.id,
          semesterId: semester.id,
          intakeStart: new Date('2026-01-01'),
          intakeEnd: new Date('2026-02-29'),
          isOpen: true,
          maxCapacity: 100
        }
      });
      
      console.log('Test data created successfully');
    }
    
    // Get the intake and programme
    const targetIntake = intake || await prisma.intake.findFirst();
    const targetProgramme = programme || await prisma.programme.findFirst();
    
    if (!targetIntake || !targetProgramme) {
      console.log('Still no intake or programme found');
      await prisma.$disconnect();
      return;
    }
    
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
        intakeId: targetIntake.id,
        programmeId: targetProgramme.id,
        modeOfStudy: 'full_time',
        scholarshipApplied: false,
        status: 'submitted',
        submittedAt: new Date(),
        accountCreated: true
      }
    });
    
    console.log('Created applicant record for Zara:', applicant.id);
    console.log('Zara is now at admission application stage');
    
    // Check Noor's status to ensure it remains unchanged
    const noorUser = await prisma.user.findUnique({
      where: { username: 'noor' },
      include: {
        student: true
      }
    });
    
    console.log('Noor status (unchanged):', {
      username: noorUser?.username,
      role: noorUser?.role,
      hasStudentRecord: !!noorUser?.student
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error adjusting Zara status:', error);
    await prisma.$disconnect();
  }
}

adjustZaraStatus();