import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../services/database.js';
import { gradeWithGemini, generateFeedback } from '../services/gemini.js';

const router = express.Router();

// ✅ Start grading process for a worksheet (no authentication)
router.post('/grade/:worksheetId', async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const { rubric, subject, gradeLevel } = req.body;

    const db = await getDb();
    const worksheets = db.collection('worksheets');

    // Get worksheet by ID
    const worksheet = await worksheets.findOne({ _id: new ObjectId(worksheetId) });

    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }

    // If no OCR data, process first
    if (!worksheet.ocrResults) {
      startFullProcessingAsync(worksheetId, worksheet);

      await worksheets.updateOne(
        { _id: new ObjectId(worksheetId) },
        {
          $set: {
            status: 'processing',
            processingStage: 'ocr',
            progress: 20,
            updatedAt: new Date(),
          },
        }
      );

      return res.json({
        success: true,
        message: 'Processing and grading started',
        worksheetId,
        status: 'processing',
      });
    }

    // Update status to grading
    await worksheets.updateOne(
      { _id: new ObjectId(worksheetId) },
      {
        $set: {
          status: 'grading',
          processingStage: 'grading',
          progress: 70,
          updatedAt: new Date(),
        },
      }
    );

    // Start grading process
    gradeWorksheetAsync(worksheetId, worksheet, rubric, subject, gradeLevel);

    res.json({
      success: true,
      message: 'Grading started',
      worksheetId,
      status: 'grading',
    });
  } catch (error) {
    console.error('Grading start error:', error);
    res.status(500).json({ error: 'Failed to start grading' });
  }
});

// ✅ Get grading results
router.get('/results/:worksheetId', async (req, res) => {
  try {
    const { worksheetId } = req.params;

    const db = await getDb();
    const worksheets = db.collection('worksheets');

    const worksheet = await worksheets.findOne({ _id: new ObjectId(worksheetId) });

    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }

    res.json({
      id: worksheet._id,
      filename: worksheet.originalName,
      studentName: worksheet.studentName,
      status: worksheet.status,
      results: worksheet.gradingResults,
      feedback: worksheet.feedback,
      completedAt: worksheet.completedAt,
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// ✅ Update manual grades (optional)
router.put('/results/:worksheetId', async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const { grades, feedback, finalScore } = req.body;

    const db = await getDb();
    const worksheets = db.collection('worksheets');

    const updateData = {
      updatedAt: new Date(),
      manuallyEdited: true,
    };

    if (grades) updateData['gradingResults.questions'] = grades;
    if (feedback) updateData.feedback = feedback;
    if (finalScore !== undefined) updateData['gradingResults.totalScore'] = finalScore;

    // If detailed question grades provided, compute totals
    if (grades && Array.isArray(grades)) {
      const totalPoints = grades.reduce((sum, q) => sum + (q.maxScore || 1), 0);
      const totalPointsEarned = grades.reduce((sum, q) => sum + (q.score || 0), 0);
      updateData['gradingResults.totalPoints'] = totalPoints;
      updateData['gradingResults.totalPointsEarned'] = totalPointsEarned;
      // If no explicit finalScore provided, compute percent
      if (finalScore === undefined) {
        updateData['gradingResults.totalScore'] = totalPoints > 0 ? Math.round((totalPointsEarned / totalPoints) * 100) : 0;
      }
    }

    // If we have either a final score or question-level grades, mark as graded
    const shouldMarkGraded = (finalScore !== undefined) || (grades && grades.length > 0);
    if (shouldMarkGraded) {
      updateData.status = 'graded';
      updateData.processingStage = 'completed';
      updateData.progress = 100;
      updateData.completedAt = new Date();
      updateData['gradingResults.gradedAt'] = new Date();
    }

    await worksheets.updateOne(
      { _id: new ObjectId(worksheetId) },
      { $set: updateData }
    );

    res.json({ message: 'Grades updated successfully', graded: !!shouldMarkGraded });
  } catch (error) {
    console.error('Update grades error:', error);
    res.status(500).json({ error: 'Failed to update grades' });
  }
});

// ✅ Async grading helper
async function gradeWorksheetAsync(worksheetId, worksheet, rubric, subject, gradeLevel) {
  try {
    const db = await getDb();
    const worksheets = db.collection('worksheets');

    const gradingResults = await gradeWithGemini({
      text: worksheet.ocrResults?.text,
      subject: subject || worksheet.metadata?.subject,
      gradeLevel: gradeLevel || worksheet.metadata?.grade,
      rubric: rubric,
      studentName: worksheet.studentName,
      customGradingInstructions: worksheet.metadata?.customGradingInstructions || '',
    });

    const feedback = await generateFeedback({
      gradingResults,
      studentName: worksheet.studentName,
      subject: subject || worksheet.metadata?.subject,
      tone: 'encouraging',
    });

    await worksheets.updateOne(
      { _id: new ObjectId(worksheetId) },
      {
        $set: {
          status: 'graded',
          processingStage: 'completed',
          progress: 100,
          gradingResults,
          feedback,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✅ Worksheet ${worksheetId} graded successfully`);
  } catch (error) {
    console.error(`❌ Error grading worksheet ${worksheetId}:`, error);
    const db = await getDb();
    const worksheets = db.collection('worksheets');
    await worksheets.updateOne(
      { _id: new ObjectId(worksheetId) },
      {
        $set: {
          status: 'error',
          processingStage: 'failed',
          errorMessage: error.message,
          updatedAt: new Date(),
        },
      }
    );
  }
}

// ✅ OCR + Grading pipeline
async function startFullProcessingAsync(worksheetId, worksheet) {
  try {
    const db = await getDb();
    const worksheets = db.collection('worksheets');
    const { processOCR } = await import('../services/ocr.js');

    await worksheets.updateOne(
      { _id: new ObjectId(worksheetId) },
      {
        $set: {
          processingStage: 'ocr',
          progress: 20,
          updatedAt: new Date(),
        },
      }
    );

    const ocrResults = await processOCR(worksheet.filePath, worksheet.mimeType);

    await worksheets.updateOne(
      { _id: new ObjectId(worksheetId) },
      {
        $set: {
          processingStage: 'grading',
          progress: 60,
          ocrResults,
          updatedAt: new Date(),
        },
      }
    );

    const updatedWorksheet = await worksheets.findOne({
      _id: new ObjectId(worksheetId),
    });

    await gradeWorksheetAsync(worksheetId, updatedWorksheet, null, null, null);
  } catch (error) {
    console.error(`❌ Full processing error for worksheet ${worksheetId}:`, error);
    const db = await getDb();
    const worksheets = db.collection('worksheets');

    await worksheets.updateOne(
      { _id: new ObjectId(worksheetId) },
      {
        $set: {
          status: 'error',
          error: `Processing failed: ${error.message}`,
          updatedAt: new Date(),
        },
      }
    );
  }
}

export default router;
