import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const TEACHER_ID = '671a0b5f2f5a0c3d12345678'; // Your teacher ID
const DB_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/aceclass';

async function populateAnalyticsData() {
    let client = null;
    try {
        client = new MongoClient(DB_URL, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('aceclass');

        // Get existing data
        console.log('📊 Fetching existing data...');
        let students = await db.collection('students').find({ teacherId: { $in: [TEACHER_ID, null, undefined] } }).toArray();
        const classes = await db.collection('classes').find({ teacherId: TEACHER_ID }).toArray();
        let worksheets = await db.collection('worksheets').find({ teacherId: { $in: ['demo-user', TEACHER_ID] }, status: 'graded' }).toArray();

        console.log(`📈 Found: ${students.length} students, ${classes.length} classes, ${worksheets.length} graded worksheets`);

        // Update students without teacherId
        if (students.length > 0) {
            const updateOps = students.filter(s => !s.teacherId).map(s => ({
                updateOne: {
                    filter: { _id: s._id },
                    update: { $set: { teacherId: TEACHER_ID } }
                }
            }));
            if (updateOps.length > 0) {
                await db.collection('students').bulkWrite(updateOps);
                console.log(`✅ Updated ${updateOps.length} students with teacherId`);
            }
        }

        if (worksheets.length === 0) {
            console.log('\n⚠️  No graded worksheets found. Generating synthetic data...\n');
            
            // Generate worksheets for existing students
            const newWorksheets = [];
            if (students.length > 0 && classes.length > 0) {
                for (const student of students) {
                    const count = Math.floor(Math.random() * 4) + 3; // 3-6 per student
                    for (let i = 0; i < count; i++) {
                        const daysAgo = Math.floor(Math.random() * 30);
                        const uploadDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
                        const score = Math.floor(Math.random() * 40) + 60; // 60-100
                        
                        newWorksheets.push({
                            _id: new ObjectId(),
                            teacherId: TEACHER_ID,
                            originalName: `worksheet_${student.name}_${i}.pdf`,
                            filename: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`,
                            fileSize: 250000,
                            mimeType: 'application/pdf',
                            uploadDate: uploadDate,
                            status: 'graded',
                            processingStage: 'completed',
                            progress: 100,
                            studentId: student._id,
                            studentName: student.name,
                            classId: classes[0]._id,
                            className: classes[0].name,
                            metadata: { subject: 'Mathematics' },
                            gradingResults: {
                                totalScore: score,
                                totalPoints: 100,
                                totalPointsEarned: score,
                                questions: generateQuestions(score)
                            },
                            feedback: { summary: 'Good work!' },
                            completedAt: new Date(uploadDate.getTime() + 60000),
                            updatedAt: new Date()
                        });
                    }
                }
                
                if (newWorksheets.length > 0) {
                    await db.collection('worksheets').insertMany(newWorksheets);
                    console.log(`✅ Created ${newWorksheets.length} sample worksheets`);
                }
            }
        }

        console.log('\n✅ Analytics data population completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.name === 'MongoServerError') {
            console.error('MongoDB Error:', error.message);
        }
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    }
}

function generateQuestions(totalScore) {
    const questions = [];
    for (let i = 1; i <= 5; i++) {
        questions.push({
            number: i,
            question: `Problem ${i}`,
            score: Math.floor(totalScore / 5),
            maxScore: 20,
            isCorrect: true
        });
    }
    return questions;
}

// Run with proper error handling
populateAnalyticsData().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

