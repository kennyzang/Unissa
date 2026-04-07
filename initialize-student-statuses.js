// Initialize student statuses after demo reset
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function initializeStudentStatuses() {
  try {
    console.log('=== Initializing student statuses ===');
    
    const password = 'Demo@2026';
    const passwordHash = await bcrypt.hash(password, 10);
    
    // 1. Ensure noor and zara users exist
    const noorUser = await prisma.user.upsert({
      where: { username: 'noor' },
      update: {
        passwordHash,
        displayName: 'Noor Haji',
        email: 'noor@unissa.edu.bn',
        role: 'student',
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null
      },
      create: {
        username: 'noor',
        passwordHash,
        displayName: 'Noor Haji',
        email: 'noor@unissa.edu.bn',
        role: 'student',
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    
    const zaraUser = await prisma.user.upsert({
      where: { username: 'zara' },
      update: {
        passwordHash,
        displayName: 'Zara Abdullah',
        email: 'zara@unissa.edu.bn',
        role: 'student',
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null
      },
      create: {
        username: 'zara',
        passwordHash,
        displayName: 'Zara Abdullah',
        email: 'zara@unissa.edu.bn',
        role: 'student',
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    
    console.log('Ensured noor and zara user accounts exist');
    
    // 2. Create required reference data if not exists
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
    
    const department = await prisma.department.upsert({
      where: { code: 'CS' },
      update: {},
      create: {
        code: 'CS',
        name: 'Computer Science',
        isActive: true
      }
    });
    
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
    
    console.log('Created required reference data');
    
    // 3. Set Noor's status to offered
    await prisma.applicant.deleteMany({ where: { userId: noorUser.id } });
    
    await prisma.applicant.create({
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
    
    // 4. Ensure Zara has no application (or create a draft)
    await prisma.applicant.deleteMany({ where: { userId: zaraUser.id } });
    
    // Optional: Create a draft application for Zara
    // await prisma.applicant.create({
    //   data: {
    //     userId: zaraUser.id,
    //     applicationRef: `APP-${Date.now()}`,
    //     fullName: 'Zara Abdullah',
    //     icPassport: '1234567890',
    //     dateOfBirth: new Date('2000-01-01'),
    //     gender: 'female',
    //     nationality: 'Brunei Darussalam',
    //     email: 'zara@unissa.edu.bn',
    //     mobile: '8888888',
    //     homeAddress: '123 Main Street, Bandar Seri Begawan',
    //     highestQualification: 'A Level',
    //     previousInstitution: 'Sultan Omar Ali Saifuddien College',
    //     yearOfCompletion: 2025,
    //     cgpa: 3.5,
    //     intakeId: intake.id,
    //     programmeId: programme.id,
    //     modeOfStudy: 'full_time',
    //     scholarshipApplied: false,
    //     status: 'draft',
    //     draftSavedAt: new Date(),
    //     accountCreated: true
    //   }
    // });
    
    console.log('Set Noor to offered status, Zara to no application');
    
    // 5. Verify the setup
    const noorApp = await prisma.applicant.findFirst({ where: { userId: noorUser.id } });
    const zaraApp = await prisma.applicant.findFirst({ where: { userId: zaraUser.id } });
    
    console.log('\n=== Verification ===');
    console.log('Noor status:', noorApp?.status);
    console.log('Noor offer ref:', noorApp?.offerRef);
    console.log('Zara has application:', !!zaraApp);
    
    console.log('\n=== Student status initialization completed ===');
    console.log('Noor: Accept Offer & Enrol stage');
    console.log('Zara: No application (needs to submit)');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error initializing student statuses:', error);
    await prisma.$disconnect();
  }
}

initializeStudentStatuses();