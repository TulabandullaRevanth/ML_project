# AceClass Analytics Data Structure Guide

## Overview

This document explains the data structure needed for analytics to work properly in aceClass.

---

## 📊 Essential Collections

### 1. Students Collection

```javascript
db.students.find()
// Returns:
{
  _id: ObjectId("690c5c2e5bf1081194bac82f"),
  name: "Surya",
  grade: "6",
  email: "",
  teacherId: "671a0b5f2f5a0c3d12345678",  // CRITICAL: Must match teacher
  classes: [
    ObjectId("690c73382f06d439aa74f005")
  ],
  parentContact: {
    name: "Parent Name",
    phone: "555-1234"
  },
  notes: "",
  isActive: true,
  createdAt: ISODate("2025-11-06T08:28:30.525Z"),
  updatedAt: ISODate("2025-11-06T08:28:30.525Z")
}
```

**Required Fields for Analytics**:
- ✅ `_id` - Unique identifier
- ✅ `name` - Student name
- ✅ `grade` - Grade level
- ✅ `teacherId` - Links to teacher (MUST BE SET)
- ✅ `classes` - Array of class IDs student is enrolled in
- ✅ `isActive` - Boolean flag

---

### 2. Classes Collection

```javascript
db.classes.find()
// Returns:
{
  _id: ObjectId("690c73382f06d439aa74f005"),
  name: "Mathematics",
  subject: "Math",
  section: "A",
  grade: "6",
  teacherId: "671a0b5f2f5a0c3d12345678",  // CRITICAL: Must match teacher
  students: [
    ObjectId("690c5c2e5bf1081194bac82f"),
    ObjectId("690c6fcf6d296323ca5cd53e"),
    ObjectId("690c9b5dcb5f11d6f5ef5b9b")
  ],
  studentCount: 3,
  classAverage: 85,
  highestScore: 95,
  lowestScore: 70,
  isActive: true,
  createdAt: ISODate("2025-11-06T00:00:00.000Z")
}
```

**Required Fields for Analytics**:
- ✅ `_id` - Unique identifier
- ✅ `name` - Class name
- ✅ `subject` - Subject area
- ✅ `grade` - Grade level
- ✅ `teacherId` - Links to teacher (MUST BE SET)
- ✅ `students` - Array of student IDs
- ✅ `isActive` - Boolean flag

---

### 3. Worksheets Collection (Most Important for Analytics)

```javascript
db.worksheets.find({ status: "graded" })
// Returns:
{
  _id: ObjectId("692692a5f4d0ae5fef81ecee"),
  teacherId: "demo-user",  // Teacher who uploaded it
  originalName: "Screenshot_30-4-2025_14373_results.bsetelangana.org.jpeg",
  filename: "1764135589247-Screenshot_30-4-2025_14373_results.bsetelangana.org.jpeg",
  mimeType: "image/jpeg",
  fileSize: 405269,
  uploadDate: ISODate("2025-11-26T05:39:49.247Z"),
  
  // CRITICAL: These fields link worksheet to student and class
  studentId: ObjectId("507f1f77bcf86cd799439012"),
  studentName: "Demo Student",
  classId: ObjectId("507f1f77bcf86cd799439013"),
  className: "Demo Class",
  
  // CRITICAL: Status must be "graded"
  status: "graded",
  processingStage: "completed",
  progress: 100,
  
  // CRITICAL: This is where analytics gets the score
  gradingResults: {
    totalScore: 86,           // CRITICAL: Used for average, trends
    totalPoints: 100,
    totalPointsEarned: 86,
    questions: [
      {
        number: 1,
        question: "Problem 1",
        score: 14,
        maxScore: 20,
        isCorrect: true,
        feedback: "Perfect!"
      },
      // ... more questions
    ],
    strengths: ["Good understanding"],
    weaknesses: ["Minor errors"],
    commonErrors: ["Sign errors"],
    recommendations: ["Practice more"]
  },
  
  feedback: {
    summary: "Good work!",
    praise: "Shows understanding",
    improvements: "Check calculations",
    nextSteps: "Continue practice",
    encouragement: "Keep it up!"
  },
  
  metadata: {
    subject: "Mathematics",
    assignment: "Topic Name"
  },
  
  completedAt: ISODate("2025-11-26T05:40:15.655Z"),
  updatedAt: ISODate("2025-11-26T05:40:15.655Z")
}
```

**CRITICAL Fields for Analytics**:
- ✅ `studentId` - Must reference existing student
- ✅ `studentName` - Display name
- ✅ `classId` - Must reference existing class
- ✅ `className` - Display name
- ✅ `status` - MUST be "graded"
- ✅ `uploadDate` - When uploaded (for trends)
- ✅ `completedAt` - When grading completed
- ✅ `gradingResults.totalScore` - THE SCORE (0-100)
- ✅ `gradingResults.totalPoints` - Max points
- ✅ `gradingResults.questions` - Question details

---

### 4. Users Collection

```javascript
db.users.find()
// Returns:
{
  _id: ObjectId("671a0b5f2f5a0c3d12345678"),
  name: "Revanth Tulabandula",
  email: "tulabandullarevanth@gmail.com",
  monthlyLimit: 100,
  worksheetsProcessed: 6,
  role: "teacher",
  isActive: true,
  createdAt: ISODate("2024-10-30T00:00:00.000Z")
}
```

**Required Fields**:
- ✅ `_id` - Unique identifier (teachers' teacherId)
- ✅ `name` - User name
- ✅ `monthlyLimit` - Max worksheets per month
- ✅ `worksheetsProcessed` - Count of uploaded worksheets
- ✅ `role` - Must be "teacher"

---

## 🔗 Data Relationships

```
User (Teacher)
  │
  ├─→ Classes
  │     │
  │     └─→ Students (enrolled in class)
  │           │
  │           └─→ Worksheets (graded)
  │                 │
  │                 └─→ Grades (in gradingResults)
  │
  └─→ Worksheets (uploaded by teacher)
        │
        └─→ Grades (in gradingResults)
```

---

## 📈 Analytics Calculation Examples

### Grade Distribution
```
Worksheets: [86, 92, 78, 88, 95, 71]
Distribution:
  A (90-100): 2 worksheets
  B (80-89): 2 worksheets
  C (70-79): 2 worksheets
```

### Performance Trends
```
Day 1: [86, 92] → Avg: 89, Count: 2
Day 2: [78, 88] → Avg: 83, Count: 2
Day 3: [95, 71] → Avg: 83, Count: 2
```

### Class Performance
```
Class Average: (86+92+78+88+95+71) / 6 = 85%
Highest: 95
Lowest: 71
Pass Rate (>= 60): 6/6 = 100%
```

### Subject Performance
```
Mathematics: 6 worksheets, Avg: 85%
Science: 3 worksheets, Avg: 82%
```

---

## ✅ Data Validation Checklist

Before analytics will work properly:

- [ ] All students have `teacherId` set
- [ ] All classes have `teacherId` set
- [ ] All worksheets have `status: "graded"`
- [ ] All worksheets have `gradingResults.totalScore`
- [ ] All worksheets have `studentId` and `classId`
- [ ] Worksheet dates are in ISO format
- [ ] Questions array is populated in gradingResults
- [ ] No null or undefined critical fields

---

## 🔧 Data Migration Script

To fix existing data, run:

```bash
node backend/scripts/populate-analytics.js
```

This script will:
1. Find all students (even without teacherId)
2. Update students with correct teacherId
3. Link existing worksheets to students/classes
4. Validate all data relationships
5. Create analytics records

---

## 📊 Sample Valid Worksheet Document

```javascript
{
  _id: new ObjectId(),
  teacherId: "671a0b5f2f5a0c3d12345678",
  originalName: "Math_Quiz_1.pdf",
  filename: "ws_1762433938523_abc123.pdf",
  mimeType: "application/pdf",
  fileSize: 250000,
  uploadDate: new Date("2025-11-26T05:39:49Z"),
  completedAt: new Date("2025-11-26T05:40:15Z"),
  
  // These link it to student and class
  studentId: new ObjectId("690c5c2e5bf1081194bac82f"),
  studentName: "Surya",
  classId: new ObjectId("690c73382f06d439aa74f005"),
  className: "Mathematics",
  
  status: "graded",
  processingStage: "completed",
  progress: 100,
  
  gradingResults: {
    totalScore: 88,
    totalPoints: 100,
    totalPointsEarned: 88,
    questions: [
      {
        number: 1,
        score: 18,
        maxScore: 20,
        isCorrect: true
      },
      {
        number: 2,
        score: 17,
        maxScore: 20,
        isCorrect: false
      },
      {
        number: 3,
        score: 20,
        maxScore: 20,
        isCorrect: true
      },
      {
        number: 4,
        score: 19,
        maxScore: 20,
        isCorrect: true
      },
      {
        number: 5,
        score: 14,
        maxScore: 20,
        isCorrect: false
      }
    ]
  },
  
  metadata: {
    subject: "Mathematics"
  },
  
  updatedAt: new Date("2025-11-26T05:40:15Z")
}
```

---

## 🎯 Quick Fixes

### Problem: "No analytics data showing"

**Fix**: Ensure worksheets have these fields:
```javascript
db.worksheets.updateMany(
  { status: "graded" },
  { $set: { teacherId: "671a0b5f2f5a0c3d12345678" } }
)
```

### Problem: "Students not showing in dropdown"

**Fix**: Link students to classes:
```javascript
db.students.updateMany(
  { _id: { $in: [...studentIds...] } },
  { $set: { teacherId: "671a0b5f2f5a0c3d12345678" } }
)
```

### Problem: "Charts showing empty"

**Fix**: Add gradingResults to worksheets:
```javascript
db.worksheets.updateMany(
  { status: "graded", gradingResults: { $exists: false } },
  { $set: { "gradingResults.totalScore": 75 } }
)
```

---

## 📝 Notes

- All dates should be ISO 8601 format: `2025-11-26T05:39:49.247Z`
- All IDs should be ObjectId type: `ObjectId("...")`
- Scores should be 0-100 percentages
- Teacher ID should be consistent across all documents
- The `demo-user` teacherId is used for sample data

---

**Version**: 1.0  
**Last Updated**: November 26, 2025
