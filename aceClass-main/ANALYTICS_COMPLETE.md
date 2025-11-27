# AceClass Analytics Data Guide

## Overview

Your aceClass database now has students and worksheets linked with teacher IDs. The analytics system uses this data to generate charts and reports on the dashboard.

## What Was Done

### ✅ Data Population Complete

1. **Updated 5 Students**
   - Surya (Grade 6)
   - Sunil (Grade 6)
   - tumba (Grade 6)
   - And 2 others

2. **Found 1 Class**
   - Mathematics (Grade 6, Section A)

3. **Linked 6 Graded Worksheets**
   - All worksheets now have proper teacherId association
   - Status: All marked as graded
   - Scores: Ranging from 60-100

## How Analytics Works

### Dashboard Charts

#### Grade Distribution Chart
- Shows the distribution of grades (A, B, C, D, F)
- Based on all graded worksheets for the teacher

#### Performance Trends Chart
- Shows average scores over time
- Displays worksheet count per day
- Last 30 days of data

### Analytics Calculation

The system calculates:
- **Average Score**: Mean of all worksheet scores
- **Highest Score**: Maximum score achieved
- **Lowest Score**: Minimum score achieved
- **Pass Rate**: Percentage of worksheets >= 60%
- **Performance Trends**: Score progression over time

## Viewing Your Analytics

### Dashboard
Visit: http://localhost:3000/pages/dashboard.html

You'll see:
- Grade distribution chart
- Performance trends chart
- Recent activity list
- Monthly usage statistics

### Analytics Page
Visit: http://localhost:3000/pages/analytics.html

You'll see:
- Subject performance breakdown
- Common mistakes analysis
- Student progress reports
- Grade trends over time

## Adding More Data

### Option 1: Upload Real Worksheets
1. Go to: http://localhost:3000/pages/upload.html
2. Select a student and class
3. Upload a worksheet image/PDF
4. The system will grade it and update analytics automatically

### Option 2: Generate More Sample Data
Run the population script again:
```bash
node backend/scripts/populate-analytics.js
```

This will create more synthetic worksheets for existing students.

## Database Structure

### Collections Used

#### `worksheets`
```javascript
{
  _id: ObjectId,
  teacherId: "671a0b5f2f5a0c3d12345678",
  studentId: ObjectId,
  studentName: "Student Name",
  classId: ObjectId,
  className: "Class Name",
  status: "graded",
  uploadDate: Date,
  completedAt: Date,
  gradingResults: {
    totalScore: 85,
    totalPoints: 100,
    totalPointsEarned: 85,
    questions: [...]
  }
}
```

#### `students`
```javascript
{
  _id: ObjectId,
  name: "Student Name",
  grade: "6",
  teacherId: "671a0b5f2f5a0c3d12345678",
  classes: [ObjectId],
  isActive: true
}
```

#### `classes`
```javascript
{
  _id: ObjectId,
  name: "Class Name",
  subject: "Subject",
  teacherId: "671a0b5f2f5a0c3d12345678",
  students: [ObjectId]
}
```

## Troubleshooting

### Charts Not Showing
1. Refresh the page (Ctrl+F5)
2. Check browser console for errors
3. Make sure worksheets have `gradingResults.totalScore`

### Analytics Empty
1. Make sure worksheets have `status: "graded"`
2. Check that `completedAt` date is set
3. Verify `gradingResults` object exists

### No Students Showing
1. Run the population script: `node backend/scripts/populate-analytics.js`
2. Check that students have `teacherId` set
3. Verify students are in a class

## Next Steps

1. **Upload More Worksheets**: Use the upload interface to add more student work
2. **Monitor Progress**: Check the dashboard regularly to see trends
3. **Review Analytics**: Use the analytics page to identify student needs
4. **Adjust Settings**: Modify grading preferences in settings

## Support

For issues:
1. Check the browser console (F12) for errors
2. Check the server logs for API issues
3. Verify MongoDB is running
4. Make sure all required fields are present in data

---

**Last Updated**: November 26, 2025
