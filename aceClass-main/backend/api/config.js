import express from 'express';
const router = express.Router();

// Simple config route placeholder (Firebase removed)
router.get('/', (req, res) => {
    res.json({ message: 'Config route active. Firebase removed.' });
});

export default router;
