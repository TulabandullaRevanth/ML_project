// Dashboard functionality for aceclass (No Auth Version)
class DashboardManager {
    constructor() {
        this.charts = {};
        this.currentUser = { name: "Revanth's", plan: "Pro" }; // static user
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardData();
        this.setupUserDropdown();
        // Start automatic refresh to pick up grading changes
        this.startAutoRefresh();
    }

    setupEventListeners() {
        const activityFilter = document.getElementById('activity-filter');
        if (activityFilter) activityFilter.addEventListener('change', () => this.loadRecentActivity());

        const gradePeriod = document.getElementById('grade-period');
        if (gradePeriod) gradePeriod.addEventListener('change', () => this.loadGradeDistribution());

        const trendsSubject = document.getElementById('trends-subject');
        if (trendsSubject) trendsSubject.addEventListener('change', () => this.loadPerformanceTrends());

        const trendsPeriod = document.getElementById('trends-period');
        if (trendsPeriod) trendsPeriod.addEventListener('change', () => this.loadPerformanceTrends());
    }

    setupUserDropdown() {
        const userAvatar = document.getElementById('user-avatar');
        const dropdown = document.getElementById('user-dropdown');

        if (!userAvatar || !dropdown) return;

        userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        document.addEventListener('click', () => dropdown.classList.remove('active'));
        dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    async loadDashboardData() {
        try {
            // Load overview data directly
            const overviewResponse = await fetch('/api/dashboard/overview');
            if (!overviewResponse.ok) throw new Error('Failed to load overview');

            const overviewData = await overviewResponse.json();

            // Set static demo user
            this.updateUserInfo(this.currentUser);

            // Display dashboard data
            this.updateStats(overviewData.stats || {});
            this.updateUsage(overviewData.user || { worksheetsProcessed: 5, monthlyLimit: 50 });
            this.displayRecentActivity(overviewData.recentWorksheets || []);

            // Load charts
            this.loadGradeDistribution();
            this.loadPerformanceTrends();
            this.loadClassPerformance();

        } catch (error) {
            console.error('Dashboard load error:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    updateUserInfo(user) {
        const userNameEl = document.getElementById('user-name');
        const userPlanEl = document.getElementById('user-plan');
        const currentPlanEl = document.getElementById('current-plan');

        if (userNameEl) userNameEl.textContent = user.name;
        if (userPlanEl) userPlanEl.textContent = `${user.plan} Plan`;
        if (currentPlanEl) currentPlanEl.textContent = `${user.plan} Plan`;

        document.querySelectorAll('.user-name-liquid').forEach(el => el.textContent = user.name);
        document.querySelectorAll('.user-plan-liquid').forEach(el => el.textContent = `${user.plan} Plan`);
    }

    updateStats(stats) {
        const totalEl = document.getElementById('total-worksheets');
        const gradedEl = document.getElementById('graded-worksheets');
        const avgEl = document.getElementById('average-score');
        const timeEl = document.getElementById('time-saved');

        if (totalEl) totalEl.textContent = stats.thisMonth?.uploaded || 0;
        if (gradedEl) gradedEl.textContent = stats.thisMonth?.graded || 0;
        if (avgEl) avgEl.textContent = `${stats.thisMonth?.averageScore || 0}%`;
        if (timeEl) {
            const timeSaved = (stats.thisMonth?.graded || 0) * 10;
            timeEl.textContent = `${Math.floor(timeSaved / 60)}h`;
        }
    }

    updateUsage(user) {
        const used = user.worksheetsProcessed || 0;
        const limit = user.monthlyLimit || 50;
        const percent = Math.round((used / limit) * 100);
        const remaining = Math.max(0, limit - used);

        const usagePercentEl = document.getElementById('monthly-usage-percent');
        const usedEl = document.getElementById('monthly-used');
        const limitEl = document.getElementById('monthly-limit');
        const remainingEl = document.getElementById('remaining-usage');
        const resetDateEl = document.getElementById('reset-date');
        const weekUsageEl = document.getElementById('week-usage');

        if (usagePercentEl) usagePercentEl.textContent = `${percent}%`;
        if (usedEl) usedEl.textContent = used;
        if (limitEl) limitEl.textContent = limit;
        if (remainingEl) remainingEl.textContent = remaining;
        
        const circle = document.getElementById('usage-circle');
        if (circle) this.updateCircularProgress(percent);

        if (resetDateEl) {
            const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
            resetDateEl.textContent = nextMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        if (weekUsageEl) weekUsageEl.textContent = Math.floor(used * 0.3);
    }

    updateCircularProgress(percent) {
        const circle = document.getElementById('usage-circle');
        const r = 34;
        const c = 2 * Math.PI * r;
        circle.style.strokeDasharray = c;
        circle.style.strokeDashoffset = c - (percent / 100) * c;
    }

    displayRecentActivity(worksheets) {
        const list = document.getElementById('activity-list');
        if (!list) return;

        if (!worksheets.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>No recent activity</p>
                    <span>Your recent grading activity will appear here</span>
                </div>`;
            return;
        }

        list.innerHTML = worksheets.map(w => `
            <div class="activity-item">
                <div class="activity-icon ${w.status}">
                    <i class="fas ${this.getStatusIcon(w.status)}"></i>
                </div>
                <div class="activity-info">
                    <div class="activity-title">${w.filename}</div>
                    <div class="activity-details">${w.studentName} • ${w.className} • ${this.timeAgo(w.uploadDate)}</div>
                </div>
                <div class="activity-actions">
                    ${w.status === 'graded'
                        ? `<button class="btn btn-outline btn-sm" onclick="dashboardManager.viewWorksheet('${w._id}')">View</button>`
                        : '<span class="status-badge processing">Processing</span>'}
                </div>
            </div>
        `).join('');
    }

    async loadGradeDistribution() {
        const res = await fetch('/api/dashboard/analytics');
        if (res.ok) {
            const data = await res.json();
            this.renderGradeDistributionChart(data.gradeDistribution || {});
        }
    }

    renderGradeDistributionChart(dist) {
        const canvas = document.getElementById('gradeChart');
        if (!canvas) return; // Skip if canvas not found
        
        const ctx = canvas.getContext('2d');
        if (this.charts.gradeChart) this.charts.gradeChart.destroy();

        const labels = Object.keys(dist);
        const values = Object.values(dist);

        this.charts.gradeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'],
                    borderWidth: 0
                }]
            },
            options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%' }
        });
    }

    async loadPerformanceTrends() {
        const res = await fetch('/api/dashboard/analytics');
        if (res.ok) {
            const data = await res.json();
            this.renderPerformanceTrendsChart(data.gradingTrends || []);
        }
    }

    renderPerformanceTrendsChart(trends) {
        const canvas = document.getElementById('trendsChart');
        if (!canvas) return; // Skip if canvas not found
        
        const ctx = canvas.getContext('2d');
        if (this.charts.trendsChart) this.charts.trendsChart.destroy();

        const labels = trends.map(t => new Date(t.date).toLocaleDateString());
        const avgScores = trends.map(t => t.averageScore);
        const counts = trends.map(t => t.count);

        this.charts.trendsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Average Score', data: avgScores, borderColor: '#3b82f6', tension: 0.4 },
                    { label: 'Worksheets Graded', data: counts, borderColor: '#10b981', tension: 0.4, yAxisID: 'y1' }
                ]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Average Score (%)' } },
                    y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Worksheets Count' } }
                }
            }
        });
    }

    async loadClassPerformance() {
        try {
            const res = await fetch('/api/dashboard/class-summary');
            if (res.ok) {
                const data = await res.json();
                this.displayClassPerformance(data);
            } else if (res.status === 404) {
                // Endpoint doesn't exist, show empty state
                this.displayClassPerformance(null);
            }
        } catch (error) {
            console.error('Error loading class performance:', error);
            this.displayClassPerformance(null);
        }
    }

    displayClassPerformance(data) {
        const grid = document.getElementById('performance-grid');
        if (!grid) return; // Exit if grid element doesn't exist
        
        if (!data || !data.students?.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No class data available</p>
                    <span>Upload and grade worksheets to see class performance</span>
                </div>`;
            return;
        }

        const summary = `
            <div class="class-summary">
                <div class="summary-stat"><div class="summary-value">${data.studentCount}</div><div class="summary-label">Students</div></div>
                <div class="summary-stat"><div class="summary-value">${data.classAverage}%</div><div class="summary-label">Class Average</div></div>
                <div class="summary-stat"><div class="summary-value">${data.highestScore}%</div><div class="summary-label">Highest Score</div></div>
                <div class="summary-stat"><div class="summary-value">${data.lowestScore}%</div><div class="summary-label">Lowest Score</div></div>
            </div>`;

        const students = data.students.map(s => `
            <div class="student-performance">
                <div class="student-info">
                    <div class="student-name">${s.name}</div>
                    <div class="student-details">${s.worksheetCount} worksheets • Last: ${this.timeAgo(s.lastActivity)}</div>
                </div>
                <div class="student-score"><div class="score-value ${this.getScoreClass(s.averageScore)}">${s.averageScore}%</div></div>
            </div>`).join('');

        grid.innerHTML = summary + `<div class="students-list">${students}</div>`;
    }

    getStatusIcon(status) {
        return {
            'completed': 'fa-check',
            'graded': 'fa-check',
            'processing': 'fa-cog',
            'error': 'fa-exclamation-triangle'
        }[status] || 'fa-file';
    }

    getScoreClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'fair';
        return 'needs-improvement';
    }

    timeAgo(date) {
        const diff = (new Date() - new Date(date)) / 1000;
        if (diff < 60) return 'just now';
        const m = diff / 60;
        if (m < 60) return `${Math.floor(m)}m ago`;
        const h = m / 60;
        if (h < 24) return `${Math.floor(h)}h ago`;
        const d = h / 24;
        if (d < 7) return `${Math.floor(d)}d ago`;
        return new Date(date).toLocaleDateString();
    }

    showError(msg) {
        console.error(msg);
    }

    viewWorksheet(id) {
        window.location.href = `/pages/grading.html?worksheet=${id}`;
    }

    // Start polling the server for updated analytics/class summary
    startAutoRefresh(intervalMs = 10000) {
        this.stopAutoRefresh();
        this._autoRefreshHandle = setInterval(async () => {
            try {
                await Promise.all([
                    this.loadClassPerformance(),
                    this.loadGradeDistribution(),
                    this.loadPerformanceTrends()
                ]);
            } catch (e) {
                console.warn('Auto refresh failed:', e);
            }
        }, intervalMs);
    }

    stopAutoRefresh() {
        if (this._autoRefreshHandle) {
            clearInterval(this._autoRefreshHandle);
            this._autoRefreshHandle = null;
        }
    }
}

// Initialize dashboard when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing dashboard (no auth mode)');
    window.dashboardManager = new DashboardManager();
});
