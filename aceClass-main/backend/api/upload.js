import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../services/database.js';
import { processOCR } from '../services/ocr.js';
import { extractStudentName, validateFileType } from '../utils/helpers.js';
import { ObjectId } from 'mongodb';

// ✅ Safe helper to prevent BSONError
function safeObjectId(id) {
  if (!id || typeof id !== "string" || id.length !== 24) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Memory storage for uploaded files
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (validateFileType(file.mimetype)) cb(null, true);
  else cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 50 }
});

// --- SINGLE FILE UPLOAD (no login) ---
router.post('/worksheet/single', upload.single('worksheet'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { studentId, classId, assignment, customGradingInstructions } = req.body;

    const db = await getDb();
    const worksheets = db.collection('worksheets');
    const students = db.collection('students');
    const classes = db.collection('classes');

    // Demo fallback IDs if none provided
    const demoStudent = studentId || new ObjectId();
    const demoClass = classId || new ObjectId();

    const student = await students.findOne({ _id: new ObjectId(demoStudent) });
    const classDoc = await classes.findOne({ _id: new ObjectId(demoClass) });

    const worksheetData = {
      teacherId: 'demo-user',
      originalName: req.file.originalname,
      filename: `${Date.now()}-${req.file.originalname}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      fileBuffer: req.file.buffer,
      uploadDate: new Date(),
      status: 'processing',
      processingStage: 'uploaded',
      progress: 0,
      studentId: new ObjectId(demoStudent),
      studentName: student?.name || 'Demo Student',
      classId: new ObjectId(demoClass),
      className: classDoc?.name || 'Demo Class',
      metadata: {
        subject: classDoc?.subject || 'General',
        grade: classDoc?.gradeLevel || 'N/A',
        assignment: assignment || 'Untitled Assignment',
        customGradingInstructions: customGradingInstructions || ''
      },
      updatedAt: new Date()
    };

    const result = await worksheets.insertOne(worksheetData);
    worksheetData._id = result.insertedId;

    // Process AI grading
    processSingleWorksheetAsync(result.insertedId, {
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    });

    res.json({
      message: 'Worksheet uploaded successfully (no auth)',
      worksheet: worksheetData
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// --- GET STATUS (no login) ---
router.get('/status/:worksheetId', async (req, res) => {
  try {
    const db = await getDb();
    const worksheets = db.collection('worksheets');
    const id = safeObjectId(req.params.worksheetId);
    if (!id) {
      console.error("Invalid worksheetId received:", req.params.worksheetId);
      return res.status(400).json({ error: "Invalid worksheet ID" });
    }

    const worksheet = await worksheets.findOne({ _id: id });

    res.json(worksheet);
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// --- GET FILE (no login) ---
router.get('/file/:worksheetId', async (req, res) => {
  try {
    const db = await getDb();
    const worksheets = db.collection('worksheets');
    const worksheet = await worksheets.findOne({ _id: new ObjectId(req.params.worksheetId) });
    if (!worksheet || !worksheet.fileBuffer)
      return res.status(404).json({ error: 'File not found' });

    const buffer = Buffer.isBuffer(worksheet.fileBuffer)
      ? worksheet.fileBuffer
      : Buffer.from(worksheet.fileBuffer.buffer || Object.values(worksheet.fileBuffer));

    res.set({
      'Content-Type': worksheet.mimeType,
      'Content-Disposition': `inline; filename="${worksheet.originalName}"`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to serve file', details: err.message });
  }
});

// --- PROCESS WORKSHEET ASYNC (AI grading) ---
async function processSingleWorksheetAsync(worksheetId, fileData) {
  try {
    const db = await getDb();
    const worksheets = db.collection('worksheets');

    await worksheets.updateOne(
      { _id: worksheetId },
      { $set: { status: 'grading', processingStage: 'grading', progress: 50 } }
    );

    // Import Gemini grading service
    const { gradeWorksheetDirect, generateFeedback } = await import('../services/gemini.js');

    const gradingResults = await gradeWorksheetDirect({
      fileBuffer: fileData.fileBuffer,
      mimeType: fileData.mimeType,
      subject: 'General',
      gradeLevel: 'N/A',
      studentName: 'Demo Student',
      assignmentName: 'Demo Assignment'
    });

    const feedback = await generateFeedback({
      gradingResults,
      studentName: 'Demo Student',
      subject: 'General',
      tone: 'encouraging'
    });

    await worksheets.updateOne(
      { _id: worksheetId },
      {
        $set: {
          status: 'graded',
          processingStage: 'completed',
          progress: 100,
          gradingResults,
          feedback,
          completedAt: new Date()
        }
      }
    );

    console.log(`✅ Worksheet ${worksheetId} graded successfully.`);
  } catch (err) {
    console.error('Grading error:', err);
    const db = await getDb();
    await db.collection('worksheets').updateOne(
      { _id: worksheetId },
      { $set: { status: 'error', error: err.message } }
    );
  }
}
// --- LIST WORKSHEETS (no auth) ---
router.get('/worksheets', async (req, res) => {
  try {
    const db = await getDb();
    const worksheets = db.collection('worksheets');
    const limit = parseInt(req.query.limit) || 50;
    const data = await worksheets.find().sort({ uploadDate: -1 }).limit(limit).toArray();
    res.json({ worksheets: data });
  } catch (err) {
    console.error('Failed to fetch worksheets:', err);
    res.status(500).json({ error: 'Failed to fetch worksheets' });
  }
});

// --- DELETE WORKSHEET (no auth) ---
router.delete('/worksheet/:worksheetId', async (req, res) => {
  try {
    const db = await getDb();
    const worksheets = db.collection('worksheets');
    const id = safeObjectId(req.params.worksheetId);

    if (!id) {
      console.error("Invalid worksheetId received:", req.params.worksheetId);
      return res.status(400).json({ error: "Invalid worksheet ID" });
    }

    const result = await worksheets.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }

    console.log(`✅ Worksheet ${req.params.worksheetId} deleted successfully.`);
    res.json({ message: 'Worksheet deleted successfully', worksheetId: req.params.worksheetId });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete worksheet', details: err.message });
  }
});

export default router;
