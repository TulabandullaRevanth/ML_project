import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../services/database.js';
import { generateAIRecommendations } from '../services/gemini.js';

const router = express.Router();

// ================================
// 🔹 Get comprehensive analytics organized by classes
// ================================
router.get('/classes', async (req, res) => {
    try {
        const db = await getDb();

        // No auth: teacherId passed as query param for testing
        const teacherId = req.query.teacherId || 'test-teacher';

        // Fetch all classes (ObjectId teacherId)
        const classes = await db.collection('classes').find({
            teacherId: ObjectId.isValid(teacherId) ? new ObjectId(teacherId) : teacherId,
            isActive: true
        }).toArray();

        if (classes.length === 0) {
            return res.json({ classes: [] });
        }

        const classAnalytics = [];

        for (const classDoc of classes) {
            const classId = classDoc._id;
            const classIdString = classId.toString();

            // Fetch worksheets - handle both ObjectId and string classId
            const worksheets = await db.collection('worksheets').find({
                teacherId: teacherId,
                $or: [
                    { classId: classId },
                    { classId: classIdString }
                ],
                status: 'graded'
            }).toArray();

            // Fetch students for this class (accept teacherId/classId as string or ObjectId)
const students = await db.collection('students').find({
    teacherId: {
        $in: [
            teacherId,
            ObjectId.isValid(teacherId) ? new ObjectId(teacherId) : null
        ]
    },
    classes: {
        $in: [
            classId,                 // ObjectId (from classDoc._id)
            classId.toString(),      // string form
            ObjectId.isValid(classId) ? new ObjectId(classId) : null
        ]
    },
    isActive: true
}).toArray();


            // Calculate student performance
            const studentPerformance = [];
            let totalClassPoints = 0;
            let totalClassPointsEarned = 0;

            for (const student of students) {
                const studentWorksheets = worksheets.filter(
                    w => w.studentId?.toString() === student._id?.toString()
                );

                if (studentWorksheets.length > 0) {
                    let totalPoints = 0;
                    let totalPointsEarned = 0;

                    for (const worksheet of studentWorksheets) {
                        if (worksheet.gradingResults) {
                            if (worksheet.gradingResults.totalPoints !== undefined) {
                                totalPoints += worksheet.gradingResults.totalPoints || 0;
                                totalPointsEarned += worksheet.gradingResults.totalPointsEarned || 0;
                            } else if (
                                worksheet.gradingResults.questions &&
                                Array.isArray(worksheet.gradingResults.questions)
                            ) {
                                const worksheetPoints = worksheet.gradingResults.questions.reduce(
                                    (sum, q) => sum + (q.maxScore || 1),
                                    0
                                );
                                const worksheetPointsEarned = worksheet.gradingResults.questions.reduce(
                                    (sum, q) => sum + (q.score || 0),
                                    0
                                );
                                totalPoints += worksheetPoints;
                                totalPointsEarned += worksheetPointsEarned;
                            } else if (worksheet.gradingResults.totalScore !== undefined) {
                                totalPoints += 100;
                                totalPointsEarned += worksheet.gradingResults.totalScore;
                            }
                        }
                    }

                    const averageScore =
                        totalPoints > 0 ? Math.round((totalPointsEarned / totalPoints) * 100) : 0;

                    totalClassPoints += totalPoints;
                    totalClassPointsEarned += totalPointsEarned;

                    studentPerformance.push({
                        studentId: student._id.toString(),
                        studentName: student.name,
                        totalWorksheets: studentWorksheets.length,
                        totalPoints,
                        totalPointsEarned,
                        averageScore,
                        grade: calculateLetterGrade(averageScore),
                        needsSupport: averageScore < 80,
                        lastActivity:
                            studentWorksheets.length > 0
                                ? new Date(Math.max(...studentWorksheets.map(w => new Date(w.completedAt))))
                                : null
                    });
                } else {
                    studentPerformance.push({
                        studentId: student._id.toString(),
                        studentName: student.name,
                        totalWorksheets: 0,
                        totalPoints: 0,
                        totalPointsEarned: 0,
                        averageScore: 0,
                        grade: 'N/A',
                        needsSupport: true,
                        lastActivity: null
                    });
                }
            }

            // Class-level metrics
            const classAverageScore =
                totalClassPoints > 0 ? Math.round((totalClassPointsEarned / totalClassPoints) * 100) : 0;

            const topPerformers = studentPerformance
                .filter(s => s.totalWorksheets > 0)
                .sort((a, b) => b.averageScore - a.averageScore)
                .slice(0, 5)
                .map((student, index) => ({
                    rank: index + 1,
                    studentId: student.studentId,
                    studentName: student.studentName,
                    averageScore: student.averageScore,
                    grade: student.grade,
                    totalWorksheets: student.totalWorksheets
                }));

            const studentsNeedingSupport = studentPerformance
                .filter(s => s.needsSupport)
                .sort((a, b) => a.averageScore - b.averageScore)
                .map(student => ({
                    studentId: student.studentId,
                    studentName: student.studentName,
                    averageScore: student.averageScore,
                    grade: student.grade,
                    totalWorksheets: student.totalWorksheets,
                    priority:
                        student.averageScore < 60
                            ? 'high'
                            : student.averageScore < 70
                            ? 'medium'
                            : 'low'
                }));

            const gradeDistribution = {
                A: studentPerformance.filter(s => s.averageScore >= 90).length,
                B: studentPerformance.filter(s => s.averageScore >= 80 && s.averageScore < 90).length,
                C: studentPerformance.filter(s => s.averageScore >= 70 && s.averageScore < 80).length,
                D: studentPerformance.filter(s => s.averageScore >= 60 && s.averageScore < 70).length,
                F: studentPerformance.filter(s => s.averageScore < 60).length
            };

            const commonMistakes = await analyzeCommonMistakes(worksheets);

            classAnalytics.push({
                classId: classDoc._id.toString(),
                className: classDoc.name || 'Unnamed Class',
                subject: classDoc.subject || 'General',
                gradeLevel: classDoc.gradeLevel || classDoc.grade || 'All',
                metrics: {
                    totalStudents: students.length,
                    totalWorksheets: worksheets.length,
                    totalPoints: totalClassPoints,
                    totalPointsEarned: totalClassPointsEarned,
                    averageScore: classAverageScore,
                    completionRate:
                        students.length > 0
                            ? Math.round(
                                  (studentPerformance.filter(s => s.totalWorksheets > 0).length /
                                      students.length) *
                                      100
                              )
                            : 0
                },
                studentPerformance,
                topPerformers,
                studentsNeedingSupport,
                gradeDistribution,
                commonMistakes,
                aiRecommendations: null
            });
        }

        res.json({
            teacherId,
            totalClasses: classes.length,
            generatedAt: new Date(),
            classes: classAnalytics
        });
    } catch (error) {
        console.error('❌ Analytics error:', error);
        res.status(500).json({ error: 'Failed to get class analytics' });
    }
});

// ================================
// 🔹 Get student grades for a specific class
// ================================
router.get('/classes/:classId/student-grades', async (req, res) => {
    try {
        const db = await getDb(); 
        const classId = req.params.classId;
        const teacherId = req.query.teacherId || 'test-teacher';

        const classDoc = await db.collection('classes').findOne({
            _id: new ObjectId(classId)
        });

        if (!classDoc) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Robust students query: supports string/ObjectId classId + teacherId
const students = await db.collection('students').find({
    teacherId: {
        $in: [
            teacherId,
            ObjectId.isValid(teacherId) ? new ObjectId(teacherId) : null
        ]
    },
    classes: {
        $in: [
            classId,
            classId.toString(),
            ObjectId.isValid(classId) ? new ObjectId(classId) : null
        ]
    },
    isActive: true
}).toArray();


        const studentGrades = [];

        for (const student of students) {
            const classIdObj = new ObjectId(classId);
            const worksheets = await db.collection('worksheets').find({
                teacherId,
                $or: [
                    { classId: classIdObj },
                    { classId: classId }
                ],
                studentId: student._id,
                status: 'graded'
            }).toArray();

            if (worksheets.length > 0) {
                let totalPoints = 0;
                let totalPointsEarned = 0;

                for (const worksheet of worksheets) {
                    if (worksheet.gradingResults) {
                        if (worksheet.gradingResults.totalPoints !== undefined) {
                            totalPoints += worksheet.gradingResults.totalPoints || 0;
                            totalPointsEarned += worksheet.gradingResults.totalPointsEarned || 0;
                        } else if (
                            worksheet.gradingResults.questions &&
                            Array.isArray(worksheet.gradingResults.questions)
                        ) {
                            totalPoints += worksheet.gradingResults.questions.reduce(
                                (sum, q) => sum + (q.maxScore || 1),
                                0
                            );
                            totalPointsEarned += worksheet.gradingResults.questions.reduce(
                                (sum, q) => sum + (q.score || 0),
                                0
                            );
                        } else if (worksheet.gradingResults.totalScore !== undefined) {
                            totalPoints += 100;
                            totalPointsEarned += worksheet.gradingResults.totalScore;
                        }
                    }
                }

                const percentage =
                    totalPoints > 0 ? Math.round((totalPointsEarned / totalPoints) * 100) : 0;

                studentGrades.push({
                    studentId: student._id.toString(),
                    studentName: student.name,
                    totalPoints,
                    totalPointsEarned,
                    percentage,
                    letterGrade: calculateLetterGrade(percentage),
                    worksheetCount: worksheets.length
                });
            } else {
                studentGrades.push({
                    studentId: student._id.toString(),
                    studentName: student.name,
                    totalPoints: 0,
                    totalPointsEarned: 0,
                    percentage: 0,
                    letterGrade: 'N/A',
                    worksheetCount: 0
                });
            }
        }

        studentGrades.sort((a, b) => a.studentName.localeCompare(b.studentName));

        res.json({
            classId,
            className: classDoc.name,
            students: studentGrades
        });
    } catch (error) {
        console.error('❌ Student grades error:', error);
        res.status(500).json({ error: 'Failed to get student grades' });
    }
});

// ================================
// 🔹 Generate AI recommendations for a class
// ================================
router.post('/classes/:classId/ai-recommendations', async (req, res) => {
    try {
        const db = await getDb();
        const classId = req.params.classId;
        const teacherId = req.query.teacherId || 'test-teacher';

        // Get class analytics data
        const classDoc = await db.collection('classes').findOne({
            _id: new ObjectId(classId)
        });

        if (!classDoc) {
            return res.status(404).json({ error: 'Class not found' });
        }

        const worksheets = await db.collection('worksheets').find({
            teacherId: teacherId,
            $or: [
                { classId: new ObjectId(classId) },
                { classId: classId }
            ],
            status: 'graded'
        }).toArray();

        const students = await db.collection('students').find({
            teacherId: ObjectId.isValid(teacherId) ? new ObjectId(teacherId) : teacherId,
            classes: new ObjectId(classId),
            isActive: true
        }).toArray();

        // Calculate class metrics
        let totalPoints = 0;
        let totalPointsEarned = 0;
        const studentScores = [];

        for (const student of students) {
            const studentWorksheets = worksheets.filter(
                w => w.studentId?.toString() === student._id?.toString()
            );

            if (studentWorksheets.length > 0) {
                let studentTotal = 0;
                let studentEarned = 0;

                for (const worksheet of studentWorksheets) {
                    if (worksheet.gradingResults) {
                        if (worksheet.gradingResults.totalPoints !== undefined) {
                            studentTotal += worksheet.gradingResults.totalPoints || 0;
                            studentEarned += worksheet.gradingResults.totalPointsEarned || 0;
                        } else if (
                            worksheet.gradingResults.questions &&
                            Array.isArray(worksheet.gradingResults.questions)
                        ) {
                            studentTotal += worksheet.gradingResults.questions.reduce(
                                (sum, q) => sum + (q.maxScore || 1),
                                0
                            );
                            studentEarned += worksheet.gradingResults.questions.reduce(
                                (sum, q) => sum + (q.score || 0),
                                0
                            );
                        }
                    }
                }

                totalPoints += studentTotal;
                totalPointsEarned += studentEarned;
                studentScores.push({
                    name: student.name,
                    score: studentTotal > 0 ? Math.round((studentEarned / studentTotal) * 100) : 0
                });
            }
        }

        const classAverage =
            totalPoints > 0 ? Math.round((totalPointsEarned / totalPoints) * 100) : 0;
        const lowPerformers = studentScores.filter(s => s.score < 70).length;

        // Build prompt for AI recommendations
        const prompt = `You are an educational expert analyzing class performance data.

Class: ${classDoc.name} (${classDoc.subject})
Total Students: ${students.length}
Class Average Score: ${classAverage}%
Low Performers (< 70%): ${lowPerformers} students
Total Worksheets Graded: ${worksheets.length}

Student Scores: ${studentScores.map(s => `${s.name}: ${s.score}%`).join(', ')}

Based on this data, provide:
1. 3 specific topics/concepts where students are struggling (if average < 80) or excelling (if average >= 80)
2. For each topic: description and 2-3 suggested activities
3. Overall class strategy recommendation

Format your response as valid JSON:
{
  "topics": [
    {
      "topic": "Topic Name",
      "description": "Why students are struggling/excelling here",
      "priority": "HIGH|MEDIUM|LOW",
      "suggestedActivities": ["Activity 1", "Activity 2", "Activity 3"]
    }
  ],
  "classStrategy": "Overall recommendation for the entire class"
}

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no additional text.`;

        // Call Gemini API using direct Gemini call for custom prompt
        const recommendations = await callGeminiForRecommendations(prompt);

        res.json({
            classId,
            className: classDoc.name,
            generatedAt: new Date(),
            recommendations
        });
    } catch (error) {
        console.error('❌ AI Recommendations error:', error);
        res.status(500).json({ error: 'Failed to generate AI recommendations' });
    }
});

// ================================
// 🔹 Helper functions
// ================================
function calculateLetterGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
}

async function analyzeCommonMistakes(worksheets) {
    const mistakeCount = {};
    worksheets.forEach(w => {
        if (w.gradingResults?.commonErrors) {
            w.gradingResults.commonErrors.forEach(err => {
                mistakeCount[err] = (mistakeCount[err] || 0) + 1;
            });
        }
    });
    return Object.entries(mistakeCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([mistake, count]) => ({ mistake, count }));
}

// Helper function to call Gemini API with custom prompt
async function callGeminiForRecommendations(prompt) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('Gemini API key not found, using mock recommendations');
            return generateMockRecommendationsForAnalytics();
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        topK: 30,
                        topP: 0.85,
                        maxOutputTokens: 2048,
                        candidateCount: 1
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
            const generatedText = result.candidates[0].content.parts[0].text;
            return parseRecommendationsFromGenini(generatedText);
        } else {
            console.warn('Invalid Gemini response structure:', result);
            return generateMockRecommendationsForAnalytics();
        }
    } catch (error) {
        console.error('Error calling Gemini for recommendations:', error);
        return generateMockRecommendationsForAnalytics();
    }
}

// Parse recommendations JSON from Gemini response
function parseRecommendationsFromGenini(text) {
    try {
        if (!text) {
            return generateMockRecommendationsForAnalytics();
        }

        // Remove markdown fences
        let cleaned = text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        // Fix trailing commas (most common failure)
        cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

        // Fix unquoted keys
        cleaned = cleaned.replace(/(\w+)\s*:/g, '"$1":');

        // Remove any non-JSON leading or trailing text
        const jsonStart = cleaned.indexOf("{");
        const jsonEnd = cleaned.lastIndexOf("}");
        if (jsonStart === -1 || jsonEnd === -1) {
            return generateMockRecommendationsForAnalytics();
        }

        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

        // FINAL ATTEMPT
        const parsed = JSON.parse(cleaned);

        return {
            topics: parsed.topics || [],
            classStrategy: parsed.classStrategy || ""
        };
    } catch (error) {
        console.error("Final JSON parse failed:", error);
        return generateMockRecommendationsForAnalytics();
    }
}


// Mock recommendations for analytics
function generateMockRecommendationsForAnalytics() {
    return {
        topics: [
            {
                topic: 'Foundational Concepts Review',
                description: 'Students need to strengthen their understanding of core concepts',
                priority: 'HIGH',
                suggestedActivities: ['Daily review exercises', 'Peer tutoring sessions', 'Concept mapping activities']
            },
            {
                topic: 'Problem-Solving Strategies',
                description: 'Practice systematic approach to solving complex problems',
                priority: 'MEDIUM',
                suggestedActivities: ['Step-by-step problem guides', 'Strategy discussion groups', 'Real-world application projects']
            },
            {
                topic: 'Calculation Accuracy',
                description: 'Reduce computational errors through practice',
                priority: 'MEDIUM',
                suggestedActivities: ['Timed practice drills', 'Error analysis exercises', 'Calculator-free practice']
            }
        ],
        classStrategy: 'Focus on interactive and collaborative learning strategies. Incorporate visual aids and real-world examples to increase engagement and understanding.'
    };
}

export default router;
