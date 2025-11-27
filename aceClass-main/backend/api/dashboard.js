import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../services/database.js';

const router = express.Router();

// ==========================
// DASHBOARD OVERVIEW ROUTE
// ==========================
router.get('/overview', async (req, res) => {
  try {
    const db = await getDb();
    const worksheets = db.collection('worksheets');
    const classes = db.collection('classes');

    // Temporarily use a static test teacher ID (replace with real one later)
    const teacherId = '671a0b5f2f5a0c3d12345678';

    // Get first class for this teacher
    const classDoc = await classes.findOne({ teacherId: new ObjectId(teacherId) });
    if (!classDoc) {
      return res.json({
        user: { name: 'Teacher', monthlyLimit: 100, worksheetsProcessed: 0, usagePercentage: 0 },
        stats: { thisMonth: { uploaded: 0, graded: 0, averageScore: 0 }, thisWeek: { uploaded: 0, graded: 0 }, status: { processing: 0, graded: 0, error: 0, total: 0 } },
        recentWorksheets: []
      });
    }

    // Date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Query stats in parallel - updated to not match on teacherId
    const [monthlyStats, weeklyStats, recentWorksheets, statusCounts] = await Promise.all([
      worksheets.aggregate([
        { $match: { uploadDate: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            totalUploaded: { $sum: 1 },
            totalGraded: { $sum: { $cond: [{ $eq: ['$status', 'graded'] }, 1, 0] } },
            averageScore: { $avg: '$gradingResults.totalScore' }
          }
        }
      ]).toArray(),

      worksheets.aggregate([
        { $match: { uploadDate: { $gte: startOfWeek } } },
        {
          $group: {
            _id: null,
            weeklyUploaded: { $sum: 1 },
            weeklyGraded: { $sum: { $cond: [{ $eq: ['$status', 'graded'] }, 1, 0] } }
          }
        }
      ]).toArray(),

      worksheets.find(
        {},
        {
          sort: { uploadDate: -1 },
          limit: 10,
          projection: {
            originalName: 1,
            studentName: 1,
            status: 1,
            uploadDate: 1,
            'gradingResults.totalScore': 1,
            'metadata.subject': 1
          }
        }
      ).toArray(),

      worksheets.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray()
    ]);

    // Build summary data
    const monthly = monthlyStats[0] || { totalUploaded: 0, totalGraded: 0, averageScore: 0 };
    const weekly = weeklyStats[0] || { weeklyUploaded: 0, weeklyGraded: 0 };

    const statusSummary = {
      processing: 0,
      graded: 0,
      error: 0,
      total: 0
    };

    statusCounts.forEach(({ _id, count }) => {
      statusSummary[_id] = count;
      statusSummary.total += count;
    });

    const overview = {
      user: {
        name: classDoc.name,
        email: 'teacher@aceclass.com',
        plan: 'Premium',
        monthlyLimit: 100,
        worksheetsProcessed: monthly.totalUploaded,
        usagePercentage: Math.round((monthly.totalUploaded / 100) * 100)
      },
      stats: {
        thisMonth: {
          uploaded: monthly.totalUploaded,
          graded: monthly.totalGraded,
          averageScore: Math.round(monthly.averageScore || 0)
        },
        thisWeek: {
          uploaded: weekly.weeklyUploaded,
          graded: weekly.weeklyGraded
        },
        status: statusSummary
      },
      recentWorksheets: recentWorksheets.map(w => ({
        id: w._id,
        filename: w.originalName,
        studentName: w.studentName || 'Unknown',
        subject: w.metadata?.subject || 'Unknown',
        status: w.status,
        score: w.gradingResults?.totalScore,
        uploadDate: w.uploadDate
      }))
    };

    res.json(overview);
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// ==========================
// ANALYTICS ROUTE
// ==========================
router.get('/analytics', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const db = await getDb();
    const worksheets = db.collection('worksheets');

    // Temporary static teacher ID for testing
    const teacherId = '671a0b5f2f5a0c3d12345678';

    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '90d': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case '1y': startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [gradingTrends, subjectPerformance, commonMistakes, studentProgress] = await Promise.all([
      worksheets.aggregate([
        {
          $match: {
            completedAt: { $gte: startDate },
            status: 'graded'
          }
        },
        {
          $group: {
            _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } } },
            count: { $sum: 1 },
            averageScore: { $avg: '$gradingResults.totalScore' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]).toArray(),

      worksheets.aggregate([
        {
          $match: {
            completedAt: { $gte: startDate },
            status: 'graded'
          }
        },
        {
          $group: {
            _id: '$metadata.subject',
            count: { $sum: 1 },
            averageScore: { $avg: '$gradingResults.totalScore' }
          }
        },
        { $sort: { count: -1 } }
      ]).toArray(),

      worksheets.aggregate([
        {
          $match: {
            completedAt: { $gte: startDate },
            status: 'graded',
            'gradingResults.commonErrors': { $exists: true, $ne: [] }
          }
        },
        { $unwind: '$gradingResults.commonErrors' },
        {
          $group: {
            _id: '$gradingResults.commonErrors',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray(),

      worksheets.aggregate([
        {
          $match: {
            completedAt: { $gte: startDate },
            status: 'graded',
            studentName: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$studentName',
            worksheetCount: { $sum: 1 },
            averageScore: { $avg: '$gradingResults.totalScore' }
          }
        },
        { $sort: { averageScore: -1 } }
      ]).toArray()
    ]);

    res.json({
      timeframe,
      gradingTrends,
      subjectPerformance,
      commonMistakes,
      studentProgress
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ==========================
// CLASS SUMMARY ROUTE
// ==========================
router.get('/class-summary', async (req, res) => {
  try {
    const db = await getDb();
    const classes = db.collection('classes');
    const students = db.collection('students');
    const worksheets = db.collection('worksheets');

    // Get the first available class (or you can make this configurable)
    const classData = await classes.findOne({});
    
    if (!classData) {
      return res.json({
        studentCount: 0,
        classAverage: 0,
        highestScore: 0,
        lowestScore: 0,
        students: []
      });
    }

    // Get all students in this class
    const classStudents = await students.find({ classId: classData._id }).toArray();

    if (classStudents.length === 0) {
      return res.json({
        studentCount: 0,
        classAverage: 0,
        highestScore: 0,
        lowestScore: 0,
        students: []
      });
    }

    // Get performance data for each student
    const studentPerformance = await Promise.all(
      classStudents.map(async (student) => {
        const studentWorksheets = await worksheets
          .find({ 
            studentId: student._id,
            classId: { $in: [classData._id, classData._id.toString()] }
          })
          .toArray();

        if (studentWorksheets.length === 0) {
          return {
            name: student.name,
            averageScore: 0,
            worksheetCount: 0,
            lastActivity: new Date()
          };
        }

        const scores = studentWorksheets
          .map(w => w.gradingResults?.totalScore || 0)
          .filter(s => s > 0);

        const averageScore = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

        const lastActivity = Math.max(...studentWorksheets.map(w => new Date(w.uploadDate || new Date())));

        return {
          name: student.name,
          averageScore,
          worksheetCount: studentWorksheets.length,
          lastActivity: new Date(lastActivity)
        };
      })
    );

    // Calculate class statistics
    const allScores = studentPerformance
      .map(s => s.averageScore)
      .filter(s => s > 0);

    const classAverage = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

    const highestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
    const lowestScore = allScores.length > 0 ? Math.min(...allScores) : 0;

    res.json({
      studentCount: classStudents.length,
      classAverage,
      highestScore,
      lowestScore,
      students: studentPerformance.sort((a, b) => b.averageScore - a.averageScore)
    });

  } catch (error) {
    console.error('Class summary error:', error);
    res.status(500).json({ error: 'Failed to get class summary' });
  }
});

export default router;
