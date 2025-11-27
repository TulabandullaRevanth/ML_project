# Analytics Data Population Guide

This guide helps you populate your aceClass database with analytics data so you can see charts and reports.

## Option 1: Run the Analytics Population Script

### Step 1: Make sure your server is running
```bash
cd D:\ML_project\aceClass-main
npm start
```

### Step 2: In a new terminal, run the analytics script
```bash
cd D:\ML_project\aceClass-main
node backend/scripts/populate-analytics.js
```

This will:
- Generate 5-8 worksheets for each existing student
- Create daily analytics records for the last 30 days
- Generate subject-based analytics
- Calculate average scores, high/low scores, and pass rates

## Option 2: Manual Data Entry via API

You can also upload worksheets manually through the dashboard, and analytics will be generated automatically.

## Expected Results

After running the script, you should see:
- **Dashboard Charts**: Grade distribution and performance trends charts will display data
- **Class Performance**: Summary statistics for each class
- **Student Analytics**: Individual student scores and performance data
- **Subject Analytics**: Performance by subject area

## Sample Data Specifications

- **Time Period**: Last 30 days
- **Worksheets per Student**: 5-8
- **Performance Distribution**: 80% high performers, 20% lower performers
- **Score Range**: 50-100 (with varied distribution)
- **Questions per Worksheet**: 5 questions
- **Point Distribution**: 4 points per question (20 total)

## Database Collections Updated

- `worksheets`: New sample worksheets added
- `analytics`: Daily and subject analytics records created

## Troubleshooting

### Script won't connect
- Make sure `MONGODB_URI` is set in your `.env` file
- Check that MongoDB is accessible

### No data showing in dashboard
- Refresh the browser page after running the script
- Check the browser console for any errors
- Make sure the teacher ID matches: `671a0b5f2f5a0c3d12345678`

### Data looks incomplete
- Run the script again to add more worksheets
- Check that your classes and students exist first

## Next Steps

1. View the dashboard: http://localhost:3000/pages/dashboard.html
2. Check the analytics: http://localhost:3000/pages/analytics.html
3. View class performance in the grading interface
4. Upload more worksheets to add to the analytics
