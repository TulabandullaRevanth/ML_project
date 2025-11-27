// Upload functionality for AceClass
class UploadManager {
    constructor() {
        this.selectedFiles = [];
        this.uploadQueue = [];
        this.isUploading = false;
        this.init();
    }

    init() {
        this.setupDropZone();
        this.setupEventListeners();
        this.loadUserData();
        this.loadRecentUploads();
    }

    setupDropZone() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');

        // Click to browse
        browseBtn.addEventListener('click', () => {
            fileInput.click();
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // File selection
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(Array.from(e.target.files));
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFiles(files);
        });
    }

    setupEventListeners() {
        // Upload button
        document.getElementById('upload-btn').addEventListener('click', () => {
            this.startUpload();
        });

        // Cancel button
        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.clearFiles();
        });

        // Clear files button
        document.getElementById('clear-files').addEventListener('click', () => {
            this.clearFiles();
        });
    }

    async loadUserData() {
    try {
        const response = await fetch('/api/auth/profile');

        if (!response.ok) {
            throw new Error(`Failed to load user data: ${response.status}`);
        }

        const userData = await response.json();
        console.log('User data loaded:', userData);

        this.displayUserData(userData);
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}


    updateUserInfo(user) {
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-plan').textContent = `${user.plan} Plan`;
    }
    async updateUsageStats() {
    try {
        const response = await fetch('/api/dashboard/overview');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        this.displayUsageStats(data);
    } catch (error) {
        console.error('Error updating usage stats:', error);
        this.showError('Failed to load usage statistics');
    }
}


    handleFiles(files) {
        const validFiles = files.filter(file => this.validateFile(file));
        
        if (validFiles.length === 0) {
            this.showNotification('No valid files selected. Please select PDF, JPG, or PNG files.', 'error');
            return;
        }

        // Check file limit
        if (this.selectedFiles.length + validFiles.length > 50) {
            this.showNotification('Maximum 50 files allowed per upload.', 'error');
            return;
        }

        validFiles.forEach(file => {
            // Check for duplicates
            if (!this.selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                this.selectedFiles.push(file);
            }
        });

        this.updateFileList();
        this.showUploadOptions();
    }

    validateFile(file) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const maxSize = 50 * 1024 * 1024; // 50MB

        if (!allowedTypes.includes(file.type)) {
            this.showNotification(`${file.name}: Invalid file type. Only PDF, JPG, and PNG files are allowed.`, 'error');
            return false;
        }

        if (file.size > maxSize) {
            this.showNotification(`${file.name}: File too large. Maximum size is 50MB.`, 'error');
            return false;
        }

        return true;
    }

    updateFileList() {
        const fileList = document.getElementById('file-list');
        const filesContainer = document.getElementById('files-container');
        
        if (this.selectedFiles.length === 0) {
            fileList.style.display = 'none';
            return;
        }

        fileList.style.display = 'block';
        
        filesContainer.innerHTML = '';
        
        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileType = this.getFileType(file.type);
            const fileSize = this.formatFileSize(file.size);
            
            fileItem.innerHTML = `
                <div class="file-icon">
                    <i class="fas ${this.getFileIcon(file.type)}"></i>
                </div>
                <div class="file-info-item">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${fileSize}</div>
                </div>
                <button class="file-remove" onclick="uploadManager.removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            filesContainer.appendChild(fileItem);
        });
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFileList();
        
        if (this.selectedFiles.length === 0) {
            this.hideUploadOptions();
        }
    }

    clearFiles() {
        this.selectedFiles = [];
        this.updateFileList();
        this.hideUploadOptions();
        
        // Reset file input
        document.getElementById('file-input').value = '';
    }

    showUploadOptions() {
        document.getElementById('upload-options').style.display = 'block';
        document.getElementById('upload-actions').style.display = 'flex';
    }

    hideUploadOptions() {
        document.getElementById('upload-options').style.display = 'none';
        document.getElementById('upload-actions').style.display = 'none';
    }
    async startUpload() {
    if (this.selectedFiles.length === 0) {
        this.showNotification('Please select a file to upload.', 'error');
        return;
    }

    if (this.isUploading) {
        this.showNotification('Upload already in progress.', 'warning');
        return;
    }

    this.isUploading = true;
    const uploadBtn = document.getElementById('upload-btn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('worksheet', this.selectedFiles[0]); // only one file!

        // Add metadata
        const subject = document.getElementById('subject-select')?.value || 'General';
        const grade = document.getElementById('grade-select')?.value || 'N/A';
        const assignment = document.getElementById('assignment-name')?.value || 'Untitled Assignment';

        formData.append('subject', subject);
        formData.append('grade', grade);
        formData.append('assignment', assignment);

        const response = await fetch('/api/upload/worksheet/single', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.worksheet && result.worksheet._id) {
            this.showNotification('Worksheet uploaded successfully!', 'success');
            window.location.href = `/pages/grading-split.html?worksheet=${result.worksheet._id}&optimized=true&source=speed-upload`;
        } else {
            throw new Error(result.error || 'Upload failed');
        }

    } catch (error) {
        console.error('Upload error:', error);
        this.showNotification(error.message || 'Upload failed. Please try again.', 'error');
    } finally {
        this.isUploading = false;
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
    }
}
    async uploadFiles() {
        if (this.selectedFiles.length === 0) {
            this.showNotification('Please select files to upload.', 'error');
            return;
        }

        if (this.isUploading) {
            this.showNotification('Upload already in progress.', 'warning');
            return;
        }

        this.isUploading = true;
        const uploadBtn = document.getElementById('upload-btn');
        const originalText = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        uploadBtn.disabled = true;

        try {
            const formData = new FormData();
            
            // Add files
            this.selectedFiles.forEach(file => {
                formData.append('worksheets', file);
            });
            // Add metadata
            const subject = document.getElementById('subject-select').value;
            const grade = document.getElementById('grade-select').value;
            const assignment = document.getElementById('assignment-name').value;

            if (subject) formData.append('subject', subject);
            if (grade) formData.append('grade', grade);
            if (assignment) formData.append('assignment', assignment);

            // Upload worksheet (no auth)
            const response = await fetch('/api/upload/worksheets', {
            method: 'POST',
            body: formData
});

            const result = await response.json();

            if (response.ok) {
                this.showNotification(`Successfully uploaded ${result.uploads.length} worksheets!`, 'success');
                this.clearFiles();
                this.showProcessingQueue(result.uploads);
                this.updateUsageStats();
                this.loadRecentUploads();
            } else {
                throw new Error(result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Upload error:', error);
            this.showNotification(error.message || 'Upload failed. Please try again.', 'error');
        } finally {
            this.isUploading = false;
            uploadBtn.innerHTML = originalText;
            uploadBtn.disabled = false;
        }
    }

    showProcessingQueue(uploads) {
        const queueSection = document.getElementById('queue-section');
        const queueList = document.getElementById('queue-list');
        
        queueSection.style.display = 'block';
        queueList.innerHTML = '';

        uploads.forEach(upload => {
            const queueItem = document.createElement('div');
            queueItem.className = 'queue-item';
            queueItem.id = `queue-${upload.id}`;
            
            queueItem.innerHTML = `
                <div class="queue-icon processing">
                    <i class="fas fa-cog fa-spin"></i>
                </div>
                <div class="queue-info">
                    <div class="queue-filename">${upload.filename}</div>
                    <div class="queue-status">Processing...</div>
                    <div class="queue-progress">
                        <div class="progress-bar-small">
                            <div class="progress-fill-small" style="width: 20%"></div>
                        </div>
                    </div>
                </div>
                <div class="queue-actions">
                    <button class="btn btn-outline btn-sm" onclick="uploadManager.cancelProcessing('${upload.id}')">
                        Cancel
                    </button>
                </div>
            `;
            
            queueList.appendChild(queueItem);
        });

        // Start polling for status updates
        this.startStatusPolling(uploads.map(u => u.id));
        this.updateQueueStats();
    }
    startStatusPolling(worksheetIds) {
    const pollInterval = setInterval(async () => {
        let allCompleted = true;
        
        for (const id of worksheetIds) {
            try {
                const response = await fetch(`/api/upload/status/${id}`);

                if (response.ok) {
                    const status = await response.json();
                    this.updateQueueItem(id, status);
                    
                    if (status.status !== 'completed' && status.status !== 'error') {
                        allCompleted = false;
                    }
                }
            } catch (error) {
                console.error(`Error polling status for ${id}:`, error);
            }
        }

        if (allCompleted) {
            clearInterval(pollInterval);
            this.updateQueueStats();
            this.loadRecentUploads();
            setTimeout(() => {
                this.hideProcessingQueue();
            }, 5000); // Hide queue after 5 seconds
        }
    }, 2000); // Poll every 2 seconds
}


    updateQueueItem(id, status) {
        const queueItem = document.getElementById(`queue-${id}`);
        if (!queueItem) return;

        const icon = queueItem.querySelector('.queue-icon');
        const statusText = queueItem.querySelector('.queue-status');
        const progressFill = queueItem.querySelector('.progress-fill-small');
        const actions = queueItem.querySelector('.queue-actions');

        // Update icon and status
        icon.className = 'queue-icon';
        if (status.status === 'completed') {
            icon.classList.add('completed');
            icon.innerHTML = '<i class="fas fa-check"></i>';
            statusText.textContent = 'Completed';
            actions.innerHTML = '<button class="btn btn-primary btn-sm" onclick="uploadManager.viewResults(\'' + id + '\')">View Results</button>';
        } else if (status.status === 'error') {
            icon.classList.add('error');
            icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            statusText.textContent = status.error || 'Error occurred';
            actions.innerHTML = '<button class="btn btn-outline btn-sm" onclick="uploadManager.retryProcessing(\'' + id + '\')">Retry</button>';
        } else {
            icon.classList.add('processing');
            icon.innerHTML = '<i class="fas fa-cog fa-spin"></i>';
            statusText.textContent = this.getStatusText(status.processingStage);
        }

        // Update progress
        if (progressFill && status.progress !== undefined) {
            progressFill.style.width = `${status.progress}%`;
        }
    }

    getStatusText(stage) {
        const stages = {
            'uploaded': 'Uploaded',
            'ocr': 'Reading text...',
            'grading': 'Grading...',
            'completed': 'Completed'
        };
        return stages[stage] || 'Processing...';
    }

    updateQueueStats() {
        const queueItems = document.querySelectorAll('.queue-item');
        let processing = 0;
        let completed = 0;

        queueItems.forEach(item => {
            const icon = item.querySelector('.queue-icon');
            if (icon.classList.contains('processing')) {
                processing++;
            } else if (icon.classList.contains('completed')) {
                completed++;
            }
        });

        document.getElementById('processing-count').textContent = processing;
        document.getElementById('completed-count').textContent = completed;
    }

    hideProcessingQueue() {
        const queueSection = document.getElementById('queue-section');
        queueSection.style.display = 'none';
    }
    async loadRecentUploads() {
    try {
        // 🩵 Removed token + Authorization header (no-auth mode)
        const response = await fetch('/api/upload/worksheets?limit=5');

        if (response.ok) {
            const data = await response.json();
            this.displayRecentUploads(data.worksheets);
        }
    } catch (error) {
        console.error('Error loading recent uploads:', error);
    }
}

displayRecentUploads(worksheets) {
    const recentList = document.getElementById('recent-list');
    
    if (worksheets.length === 0) {
        recentList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-upload"></i>
                <p>No recent uploads</p>
                <span>Upload your first worksheet to get started</span>
            </div>
        `;
        return;
    }

    recentList.innerHTML = '';
    
    worksheets.forEach(worksheet => {
        const recentItem = document.createElement('div');
        recentItem.className = 'recent-item';
        
        const statusIcon = this.getStatusIcon(worksheet.status);
        const timeAgo = this.timeAgo(worksheet.uploadDate);
        
        recentItem.innerHTML = `
            <div class="recent-icon ${worksheet.status}">
                <i class="fas ${statusIcon}"></i>
            </div>
            <div class="recent-info">
                <div class="recent-filename">${worksheet.originalName}</div>
                <div class="recent-details">
                    ${worksheet.studentName || 'Unknown Student'} • 
                    ${worksheet.metadata?.subject || 'Unknown Subject'} • 
                    ${timeAgo}
                </div>
            </div>
            <div class="recent-actions">
                ${worksheet.status === 'completed' 
                    ? `<button class="btn btn-primary btn-sm" onclick="uploadManager.viewResults('${worksheet._id}')">View Results</button>`
                    : worksheet.status === 'error'
                        ? `<button class="btn btn-outline btn-sm" onclick="uploadManager.retryProcessing('${worksheet._id}')">Retry</button>`
                        : `<button class="btn btn-outline btn-sm" disabled>Processing...</button>`
                }
            </div>
        `;
        
        recentList.appendChild(recentItem);
    });
}

// Utility methods
getFileType(mimeType) {
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.startsWith('image/')) return 'Image';
    return 'File';
}

getFileIcon(mimeType) {
    if (mimeType === 'application/pdf') return 'fa-file-pdf';
    if (mimeType.startsWith('image/')) return 'fa-file-image';
    return 'fa-file';
}

getStatusIcon(status) {
    const icons = {
        'completed': 'fa-check',
        'graded': 'fa-check',
        'processing': 'fa-cog',
        'error': 'fa-exclamation-triangle'
    };
    return icons[status] || 'fa-file';
}

formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

timeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return 'just now';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// Action handlers
cancelProcessing(worksheetId) {
    console.log('Cancel processing:', worksheetId);
    this.showNotification('Processing cancellation not yet implemented.', 'info');
}

retryProcessing(worksheetId) {
    console.log('Retry processing:', worksheetId);
    this.showNotification('Processing retry not yet implemented.', 'info');
}

viewResults(worksheetId) {
    window.location.href = `/pages/grading.html?worksheet=${worksheetId}`;
}

showNotification(message, type = 'info') {
    if (window.gradeflow && window.gradeflow.showNotification) {
        window.gradeflow.showNotification(message, type);
    } else {
        alert(message);
    }
}

// close UploadManager class
}

// Initialize upload manager when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadManager();
});











// --- SINGLE FILE UPLOAD (PRODUCTION — FIXED VERSION) ---
router.post('/worksheet/single', upload.single('worksheet'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { studentId, classId, assignment, customGradingInstructions } = req.body;

    // ❌ STOP using demo IDs
    // ❌ STOP generating new ObjectIds
    // ✔ Use EXACT frontend-provided IDs
    const studentObjectId = new ObjectId(studentId);
    const classObjectId = new ObjectId(classId);

    const teacherId = "671a0b5f2f5a0c3d12345678"; // your real teacher ID

    const db = await getDb();
    const worksheets = db.collection('worksheets');
    const students = db.collection('students');
    const classes = db.collection('classes');

    const student = await students.findOne({ _id: studentObjectId });
    const classDoc = await classes.findOne({ _id: classObjectId });

    if (!student) return res.status(400).json({ error: "Student not found" });
    if (!classDoc) return res.status(400).json({ error: "Class not found" });

    const worksheetData = {
      teacherId,
      originalName: req.file.originalname,
      filename: `${Date.now()}-${req.file.originalname}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      fileBuffer: req.file.buffer,
      uploadDate: new Date(),
      status: "processing",
      processingStage: "uploaded",
      progress: 0,

      // ✔ Correct relational links
      studentId: studentObjectId,
      studentName: student.name,
      classId: classObjectId,
      className: classDoc.name,

      metadata: {
        subject: classDoc.subject,
        grade: classDoc.grade || classDoc.gradeLevel,
        assignment: assignment || "Untitled Assignment",
        customGradingInstructions: customGradingInstructions || ""
      },

      updatedAt: new Date()
    };

    const result = await worksheets.insertOne(worksheetData);

    // Async grading
    processSingleWorksheetAsync(result.insertedId, {
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    });

    res.json({
      message: "Worksheet uploaded successfully",
      worksheet: { _id: result.insertedId }
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

