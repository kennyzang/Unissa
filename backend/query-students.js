const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.student.count({ where: { status: 'active' } });
    console.log('Active students count:', count);
    
    const allStudents = await prisma.student.findMany();
    console.log('Total students count:', allStudents.length);
    
    // 检查学生状态分布
    const statusCounts = await prisma.student.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    console.log('Status distribution:', statusCounts);
  } catch (error) {
    console.error('Error querying students:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
