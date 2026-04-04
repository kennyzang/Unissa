import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Student {
  id: string
  studentId: string
  currentCgpa: number
  user: {
    displayName: string
    email: string
  }
  programme: {
    code: string
    name: string
    department: {
      name: string
    }
  }
  intake: {
    semester: {
      name: string
    }
  }
}

interface Enrolment {
  id: string
  status: string
  finalGrade: string
  gradePoints: number
  registeredAt: string
  offering: {
    id: string
    course: {
      code: string
      name: string
      creditHours: number
    }
    semester: {
      id: string
      name: string
    }
  }
}

interface GpaRecord {
  id: string
  semesterId: string
  semesterGpa: number
  cumulativeGpa: number
  totalChPassed: number
  semester: {
    id: string
    name: string
  }
}

const GRADE_LABELS: Record<string, string> = {
  A_plus: 'A+',
  A: 'A',
  B_plus: 'B+',
  B: 'B',
  C_plus: 'C+',
  C: 'C',
  D: 'D',
  F: 'F',
}

export const generateTranscriptPDF = (
  student: Student,
  enrolments: Enrolment[],
  gpaRecords: GpaRecord[]
): void => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let currentY = 20

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('UNIVERSITI ISLAM SULTAN SHARIF ALI', pageWidth / 2, currentY, { align: 'center' })
  currentY += 8

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('ACADEMIC TRANSCRIPT', pageWidth / 2, currentY, { align: 'center' })
  currentY += 15

  doc.setDrawColor(22, 93, 255)
  doc.setLineWidth(0.5)
  doc.line(20, currentY, pageWidth - 20, currentY)
  currentY += 10

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Student Information', 20, currentY)
  currentY += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const studentInfo = [
    ['Student Name:', student.user.displayName],
    ['Student ID:', student.studentId],
    ['Programme:', student.programme?.name || 'N/A'],
    ['Intake:', student.intake?.semester?.name || 'N/A'],
  ]

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: studentInfo,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 20, right: 20 },
  })

  currentY = (doc as any).lastAutoTable.finalY + 10

  const completedEnrolments = enrolments.filter(e => e.status === 'completed' || e.finalGrade)
  const totalCreditHours = completedEnrolments.reduce(
    (sum, e) => sum + (e.offering?.course?.creditHours ?? 0),
    0
  )
  const totalGradePoints = completedEnrolments.reduce(
    (sum, e) => sum + (e.gradePoints ?? 0) * (e.offering?.course?.creditHours ?? 0),
    0
  )
  const calculatedGpa = totalCreditHours > 0 ? totalGradePoints / totalCreditHours : 0

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Academic Summary', 20, currentY)
  currentY += 8

  const summaryData = [
    ['Current GPA:', (student.currentCgpa ?? calculatedGpa).toFixed(2)],
    ['Courses Completed:', completedEnrolments.length.toString()],
    ['Credit Hours Earned:', totalCreditHours.toString()],
  ]

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: summaryData,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 20, right: 20 },
  })

  currentY = (doc as any).lastAutoTable.finalY + 10

  if (gpaRecords.length > 0) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('GPA History', 20, currentY)
    currentY += 8

    const gpaData = gpaRecords.map(record => [
      record.semester?.name || 'N/A',
      record.semesterGpa.toFixed(2),
      record.cumulativeGpa.toFixed(2),
      `${record.totalChPassed} CH`,
    ])

    autoTable(doc, {
      startY: currentY,
      head: [['Semester', 'Semester GPA', 'Cumulative GPA', 'Credit Hours']],
      body: gpaData,
      theme: 'striped',
      headStyles: {
        fillColor: [22, 93, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
      },
      margin: { left: 20, right: 20 },
    })

    currentY = (doc as any).lastAutoTable.finalY + 10
  }

  if (completedEnrolments.length > 0) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Course Record', 20, currentY)
    currentY += 8

    const groupBySemester = (items: Enrolment[]) => {
      const groups: Record<string, Enrolment[]> = {}
      for (const item of items) {
        const semId = item.offering?.semester?.id ?? 'unknown'
        if (!groups[semId]) groups[semId] = []
        groups[semId].push(item)
      }
      return groups
    }

    const semesterGroups = groupBySemester(completedEnrolments)

    Object.entries(semesterGroups).forEach(([, items]) => {
      const semesterName = items[0]?.offering?.semester?.name || 'Unknown Semester'

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(22, 93, 255)
      doc.text(semesterName, 20, currentY)
      doc.setTextColor(0, 0, 0)
      currentY += 6

      const courseData = items.map(enrolment => [
        enrolment.offering?.course?.code || 'N/A',
        enrolment.offering?.course?.name || 'N/A',
        enrolment.offering?.course?.creditHours?.toString() || '0',
        GRADE_LABELS[enrolment.finalGrade] || enrolment.finalGrade || 'N/A',
        enrolment.gradePoints?.toFixed(2) || '-',
      ])

      autoTable(doc, {
        startY: currentY,
        head: [['Code', 'Course', 'CH', 'Grade', 'Points']],
        body: courseData,
        theme: 'striped',
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontSize: 9,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 25, halign: 'center' },
        },
        margin: { left: 20, right: 20 },
      })

      currentY = (doc as any).lastAutoTable.finalY + 8

      if (currentY > 250) {
        doc.addPage()
        currentY = 20
      }
    })
  }

  currentY = Math.max(currentY, (doc as any).lastAutoTable?.finalY + 15 || 250)

  if (currentY > 270) {
    doc.addPage()
    currentY = 20
  }

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(20, currentY, pageWidth - 20, currentY)
  currentY += 8

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  doc.text('This is an official academic transcript from Universiti Islam Sultan Sharif Ali.', pageWidth / 2, currentY, { align: 'center' })
  currentY += 5
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY, { align: 'center' })

  const fileName = `Transcript_${student.studentId}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}
