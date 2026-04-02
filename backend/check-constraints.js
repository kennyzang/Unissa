require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('=== 检查唯一约束冲突 ===\n');
    
    // 检查新学生的IC号码是否已存在
    const newStudentICs = [
      'IC-2002011213', 'IC-2002031814', 'IC-2002052215', 'IC-2002073016',
      'IC-2002091417', 'IC-2002112818', 'IC-2002020619', 'IC-2002042020',
      'IC-2002060821', 'IC-2002081622', 'IC-2002102423', 'IC-2002120224'
    ];
    
    console.log('=== 检查IC号码 ===');
    for (const ic of newStudentICs) {
      const existing = await prisma.applicant.findUnique({ where: { icPassport: ic } });
      console.log(`${ic}: ${existing ? `❌ 已存在 (${existing.fullName})` : '✅ 可用'}`);
    }
    
    // 检查新学生的applicationRef是否已存在
    const newStudentRefs = [
      'APP-2026-2026025', 'APP-2026-2026026', 'APP-2026-2026027', 'APP-2026-2026028',
      'APP-2026-2026029', 'APP-2026-2026030', 'APP-2026-2026031', 'APP-2026-2026032',
      'APP-2026-2026033', 'APP-2026-2026034', 'APP-2026-2026035', 'APP-2026-2026036'
    ];
    
    console.log('\n=== 检查ApplicationRef ===');
    for (const ref of newStudentRefs) {
      const existing = await prisma.applicant.findUnique({ where: { applicationRef: ref } });
      console.log(`${ref}: ${existing ? `❌ 已存在 (${existing.fullName})` : '✅ 可用'}`);
    }
    
    // 检查新学生的studentId是否已存在
    const newStudentIds = [
      '2026025', '2026026', '2026027', '2026028',
      '2026029', '2026030', '2026031', '2026032',
      '2026033', '2026034', '2026035', '2026036'
    ];
    
    console.log('\n=== 检查StudentId ===');
    for (const id of newStudentIds) {
      const existing = await prisma.student.findUnique({ where: { studentId: id } });
      console.log(`${id}: ${existing ? `❌ 已存在` : '✅ 可用'}`);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
