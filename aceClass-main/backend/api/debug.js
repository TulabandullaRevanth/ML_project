import express from 'express';
import { getDb } from '../services/database.js';

const router = express.Router();

// ✅ Debug endpoint to check environment variables and database connection
router.get('/env', async (req, res) => {
    try {
        const envStatus = {
            MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'MISSING',
            NODE_ENV: process.env.NODE_ENV || 'NOT SET'
        };

        // ✅ Test database connection
        let dbStatus = 'UNKNOWN';
        try {
            const db = await getDb();
            await db.admin().ping();
            dbStatus = 'CONNECTED';
        } catch (dbError) {
            dbStatus = `ERROR: ${dbError.message}`;
        }

        res.json({
            environment: envStatus,
            database: dbStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// ✅ Simple test endpoint
router.post('/test', async (req, res) => {
    try {
        res.json({
            message: 'Debug test endpoint working',
            receivedData: req.body || {},
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

export default router;
