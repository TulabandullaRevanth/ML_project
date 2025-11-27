import { MongoClient, ObjectId } from 'mongodb';

const uri = 'mongodb+srv://tulabandulla:Revanth123%2F@aceclass-main.kys7lrl.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

async function populateTestData() {
  try {
    await client.connect();
    const db = client.db('aceclass');
    
    console.log('📊 Checking current data...');
    
    const teacherId = '671a0b5f2f5a0c3d12345678';
    const teacherObjectId = new ObjectId(teacherId);
    
    // Get or create class
    let classDoc = await db.collection('classes').findOne({ 
      name: 'Mathematics',
      subject: 'Math'
    });
    
    if (!classDoc) {
      console.log('Creating class...');
      const result = await db.collection('classes').insertOne({
        name: 'Mathematics',
        subject: 'Math',
        gradeLevel: 6,
        teacherId: teacherObjectId,
        isActive: true,
        createdAt: new Date()
      });
      classDoc = { _id: result.insertedId, name: 'Mathematics', subject: 'Math', gradeLevel: 6 };
    }
    console.log('✅ Class:', classDoc.name, 'ID:', classDoc._id);
    
    // Get or create students
    const studentNames = ['Surya', 'Sunil', 'tumba', 'John Smith', 'Cooper Flagg'];
    const students = [];
    
    for (const name of studentNames) {
      let student = await db.collection('students').findOne({ name });
      
      if (!student) {
        console.log('Creating student:', name);
        const result = await db.collection('students').insertOne({
          name,
          teacherId: teacherObjectId,
          classes: [classDoc._id],
          isActive: true,
          createdAt: new Date()
        });
        student = { _id: result.insertedId, name };
      } else {
        // Update to include class if not there
        if (!student.classes.some(c => c.toString() === classDoc._id.toString())) {
          await db.collection('students').updateOne(
            { _id: student._id },
            { $push: { classes: classDoc._id } }
          );
        }
      }
      students.push(student);
    }
    console.log('✅ Students:', students.length);
    
    // Create worksheets with grading results
    const grades = [95, 92, 88, 45, 100];
    const worksheetCount = 3;
    
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const grade = grades[i];
      
      for (let w = 1; w <= worksheetCount; w++) {
        const existing = await db.collection('worksheets').findOne({
          studentId: student._id,
          classId: classDoc._id,
          name: `Worksheet ${w}`
        });
        
        if (!existing) {
          console.log(`Creating worksheet for ${student.name} - Worksheet ${w} (Grade: ${grade}%)`);
          
          const points = 100;
          const earned = Math.round((grade / 100) * points);
          
          await db.collection('worksheets').insertOne({
            studentId: student._id,
            classId: classDoc._id,
            teacherId: teacherId,
            name: `Worksheet ${w}`,
            status: 'graded',
            gradingResults: {
              totalScore: grade,
              totalPoints: points,
              totalPointsEarned: earned,
              questions: [
                { number: 1, score: Math.round(earned * 0.5), maxScore: 50, isCorrect: true },
                { number: 2, score: Math.round(earned * 0.5), maxScore: 50, isCorrect: grade >= 90 }
              ],
              strengths: ['Good problem solving', 'Clear work shown'],
              weaknesses: [],
              recommendations: ['Continue practicing']
            },
            completedAt: new Date(),
            createdAt: new Date()
          });
        }
      }
    }
    
    // Count final data
    const finalWorksheets = await db.collection('worksheets').find({
      classId: classDoc._id,
      status: 'graded'
    }).toArray();
    
    console.log('\n✅ POPULATION COMPLETE!');
    console.log(`   Class: ${classDoc.name}`);
    console.log(`   Students: ${students.length}`);
    console.log(`   Graded Worksheets: ${finalWorksheets.length}`);
    
    // Show grade distribution
    const avgGrade = grades.reduce((a, b) => a + b) / grades.length;
    console.log(`   Average Grade: ${Math.round(avgGrade)}%`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

populateTestData();
