import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../services/database.js';
import {
  validateStudentCreation,
  validateStudentUpdate,
  createStudentDocument,
  sanitizeStudentForResponse,
  searchStudents,
  calculateStudentStats
} from '../models/student.js';

const router = express.Router();

/**
 * ✅ NO AUTH VERSION
 * - All routes are public (no JWT)
 * - Removed teacherId filters
 * - Uses only database logic
 */

// Get all students
router.get('/', async (req, res) => {
  try {
    const { search, classId, grade, page = 1, limit = 50 } = req.query;
    const db = await getDb();
    const students = db.collection('students');
    
    const filter = {
  teacherId: new ObjectId("671a0b5f2f5a0c3d12345678"),
  isActive: true
};

    if (classId) filter.classes = new ObjectId(classId);
    if (grade) filter.grade = grade;

    const options = {
      sort: { name: 1 },
      skip: (page - 1) * parseInt(limit),
      limit: parseInt(limit)
    };

    let [results, total] = await Promise.all([
      students.find(filter, options).toArray(),
      students.countDocuments(filter)
    ]);

    if (search) {
      results = searchStudents(results, search);
      total = results.length;
    }

    // Populate class info
    if (results.length > 0) {
      const classes = db.collection('classes');
      const classIds = [...new Set(results.flatMap(s => s.classes || []))];

      if (classIds.length > 0) {
        const classData = await classes
          .find({ _id: { $in: classIds } })
          .toArray();

        const classMap = new Map(classData.map(c => [c._id.toString(), c]));
        results = results.map(student => ({
          ...sanitizeStudentForResponse(student),
          classDetails: (student.classes || [])
            .map(id => classMap.get(id.toString()))
            .filter(Boolean)
        }));
      }
    }

    res.json({
      students: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to get students' });
  }
});

// Get student by ID
router.get('/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const db = await getDb();
    const students = db.collection('students');

    const student = await students.findOne({ _id: new ObjectId(studentId) });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    if (student.classes?.length > 0) {
      const classes = db.collection('classes');
      student.classDetails = await classes
        .find({ _id: { $in: student.classes } })
        .toArray();
    }

    res.json({ student: sanitizeStudentForResponse(student) });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to get student' });
  }
});

// Create student
router.post('/', async (req, res) => {
  try {
    const studentData = req.body;
    const validationErrors = validateStudentCreation(studentData);
    if (validationErrors.length > 0)
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });

    const db = await getDb();
    const students = db.collection('students');

    // Check for duplicate name
    const existing = await students.findOne({
      name: { $regex: new RegExp(`^${studentData.name.trim()}$`, 'i') },
      isActive: true
    });

    if (existing)
      return res.status(409).json({ error: 'A student with this name already exists' });

    const newStudent = createStudentDocument(null, studentData);
    const result = await students.insertOne(newStudent);
    newStudent._id = result.insertedId;

    // Add to classes if provided
    if (studentData.classes?.length > 0) {
      const classes = db.collection('classes');
      const classIds = studentData.classes.map(id => new ObjectId(id));
      await classes.updateMany(
        { _id: { $in: classIds } },
        {
          $addToSet: { students: result.insertedId },
          $set: { updatedAt: new Date() }
        }
      );
    }

    res.status(201).json({
      message: 'Student created successfully',
      student: sanitizeStudentForResponse(newStudent)
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Update student
router.put('/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const updateData = req.body;
    const validationErrors = validateStudentUpdate(updateData);
    if (validationErrors.length > 0)
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });

    const db = await getDb();
    const students = db.collection('students');
    const existing = await students.findOne({ _id: new ObjectId(studentId) });
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const updateFields = { updatedAt: new Date() };
    if (updateData.name) updateFields.name = updateData.name.trim();
    if (updateData.grade) updateFields.grade = updateData.grade;
    if (updateData.email) updateFields.email = updateData.email.toLowerCase().trim();
    if (updateData.parentContact) updateFields.parentContact = updateData.parentContact;
    if (updateData.notes) updateFields.notes = updateData.notes.trim();
    if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive;

    // Update classes if provided
    if (updateData.classes) {
      const classes = db.collection('classes');
      const newClassIds = updateData.classes.map(id => new ObjectId(id));
      const oldClassIds = existing.classes || [];

      if (oldClassIds.length > 0) {
        await classes.updateMany(
          { _id: { $in: oldClassIds } },
          {
            $pull: { students: new ObjectId(studentId) },
            $set: { updatedAt: new Date() }
          }
        );
      }

      if (newClassIds.length > 0) {
        await classes.updateMany(
          { _id: { $in: newClassIds } },
          {
            $addToSet: { students: new ObjectId(studentId) },
            $set: { updatedAt: new Date() }
          }
        );
      }

      updateFields.classes = newClassIds;
    }

    await students.updateOne({ _id: new ObjectId(studentId) }, { $set: updateFields });
    const updatedStudent = await students.findOne({ _id: new ObjectId(studentId) });

    res.json({
      message: 'Student updated successfully',
      student: sanitizeStudentForResponse(updatedStudent)
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student (soft delete)
router.delete('/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const db = await getDb();
    const students = db.collection('students');

    const student = await students.findOne({ _id: new ObjectId(studentId) });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    await students.updateOne(
      { _id: new ObjectId(studentId) },
      {
        $set: { isActive: false, updatedAt: new Date() }
      }
    );

    if (student.classes?.length > 0) {
      const classes = db.collection('classes');
      await classes.updateMany(
        { _id: { $in: student.classes } },
        {
          $pull: { students: new ObjectId(studentId) },
          $set: { updatedAt: new Date() }
        }
      );
    }

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Get overview stats
router.get('/stats/overview', async (req, res) => {
  try {
    const db = await getDb();
    const students = db.collection('students');
    const list = await students.find({ isActive: true }).toArray();

    const stats = calculateStudentStats(list);
    res.json({ stats });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({ error: 'Failed to get student statistics' });
  }
});

// Dropdown search
router.get('/search/dropdown', async (req, res) => {
  try {
    const { q, classId, limit = 20 } = req.query;
    const db = await getDb();
    const students = db.collection('students');

    const filter = { isActive: true };
    if (classId) filter.classes = new ObjectId(classId);

    let results = await students.find(filter, {
      sort: { name: 1 },
      limit: parseInt(limit)
    }).toArray();

    if (q && q.trim()) {
      const searchTerm = q.toLowerCase().trim();
      results = results.filter(s => s.name.toLowerCase().includes(searchTerm));
    }

    const dropdownOptions = results.map(s => ({
      value: s._id.toString(),
      label: s.name,
      grade: s.grade,
      classes: s.classes || []
    }));

    res.json({
      options: dropdownOptions,
      hasMore: results.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Search students error:', error);
    res.status(500).json({ error: 'Failed to search students' });
  }
});

export default router;
