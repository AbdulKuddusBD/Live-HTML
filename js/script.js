// DOM Elements
const htmlEditor = document.getElementById('htmlEditor');
const cssEditor = document.getElementById('cssEditor');
const jsEditor = document.getElementById('jsEditor');
const preview = document.getElementById('livePreview');
const navItems = document.querySelectorAll('.nav-item');
const fileTabs = document.querySelectorAll('.file-tab');
const previewTabs = document.querySelectorAll('.preview-tab');
const previewContainer = document.getElementById('previewContainer');
const consoleOutput = document.getElementById('consoleOutput');
const cursorPosition = document.getElementById('cursorPosition');
const fileSize = document.getElementById('fileSize');
const wordCount = document.getElementById('wordCount');
const themeToggle = document.getElementById('themeToggle');
const saveModal = document.getElementById('saveModal');
const formatBtn = document.getElementById('formatBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const refreshPreview = document.getElementById('refreshPreview');
const openInNew = document.getElementById('openInNew');
const clearConsole = document.getElementById('clearConsole');

// State
let undoStack = [];
let redoStack = [];
let autoSaveTimer = null;

// Initialize
function init() {
    setupEventListeners();
    updatePreview();
    startAutoSave();
    updateEditorStats();
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            switchEditor(tab);
        });
    });

    // File tabs
    fileTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('close-tab')) {
                const file = tab.dataset.file;
                switchEditor(file);
            }
        });
    });

    // Close tab buttons
    document.querySelectorAll('.close-tab').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tab = e.target.closest('.file-tab');
            // Don't close if it's the only tab
            if (document.querySelectorAll('.file-tab').length > 1) {
                tab.remove();
            }
        });
    });

    // Preview tabs
    previewTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view;
            switchPreview(view);
        });
    });

    // Auto-update preview on input
    [htmlEditor, cssEditor, jsEditor].forEach(editor => {
        editor.addEventListener('input', () => {
            updatePreview();
            updateEditorStats();
            pushToUndoStack();
        });

        editor.addEventListener('keyup', (e) => {
            updateCursorPosition(e.target);
        });

        editor.addEventListener('scroll', syncScroll);
    });

    // Theme toggle
    themeToggle.addEventListener('change', toggleTheme);

    // Toolbar buttons
    document.getElementById('newBtn').addEventListener('click', newFile);
    document.getElementById('saveBtn').addEventListener('click', showSaveModal);
    document.getElementById('loadBtn').addEventListener('click', loadFile);
    document.getElementById('exportBtn').addEventListener('click', exportFiles);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('settingsBtn').addEventListener('click', showSettings);

    // Format button
    formatBtn.addEventListener('click', formatCode);

    // Undo/Redo
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    // Preview actions
    refreshPreview.addEventListener('click', updatePreview);
    openInNew.addEventListener('click', openInNewWindow);
    clearConsole.addEventListener('click', () => {
        consoleOutput.innerHTML = '';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Modal close
    document.querySelector('.close-modal').addEventListener('click', () => {
        saveModal.classList.remove('active');
    });

    document.querySelector('.modal-btn.cancel').addEventListener('click', () => {
        saveModal.classList.remove('active');
    });

    document.querySelector('.modal-btn.save').addEventListener('click', saveFile);
}

// Switch editor
function switchEditor(tab) {
    // Update nav items
    navItems.forEach(item => {
        if (item.dataset.tab === tab) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update file tabs
    fileTabs.forEach(fileTab => {
        if (fileTab.dataset.file === tab) {
            fileTab.classList.add('active');
        } else {
            fileTab.classList.remove('active');
        }
    });

    // Update editors
    document.querySelectorAll('.code-editor').forEach(editor => {
        if (editor.id === tab + 'Editor') {
            editor.classList.add('active');
        } else {
            editor.classList.remove('active');
        }
    });
}

// Switch preview
function switchPreview(view) {
    // Update preview tabs
    previewTabs.forEach(tab => {
        if (tab.dataset.view === view) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update preview container
    previewContainer.dataset.view = view;
}

// Update preview
function updatePreview() {
    const html = htmlEditor.value;
    const css = cssEditor.value;
    const js = jsEditor.value;

    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = function(...args) {
        addToConsole('log', ...args);
        originalLog.apply(console, args);
    };
    
    console.error = function(...args) {
        addToConsole('error', ...args);
        originalError.apply(console, args);
    };

    const previewContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            <style>${css}</style>
        </head>
        <body>
            ${html}
            <script>
                // Override console for preview
                const originalConsole = console;
                console = {
                    log: function(...args) {
                        originalConsole.log(...args);
                        window.parent.postMessage({type: 'console', method: 'log', args: args}, '*');
                    },
                    error: function(...args) {
                        originalConsole.error(...args);
                        window.parent.postMessage({type: 'console', method: 'error', args: args}, '*');
                    }
                };
                
                try {
                    ${js}
                } catch (error) {
                    console.error(error);
                }
            <\/script>
        </body>
        </html>
    `;

    preview.srcdoc = previewContent;
}

// Listen for console messages from iframe
window.addEventListener('message', (event) => {
    if (event.data.type === 'console') {
        addToConsole(event.data.method, ...event.data.args);
    }
});

// Add to console
function addToConsole(method, ...args) {
    const logEntry = document.createElement('div');
    logEntry.className = 'console-log';
    
    let content = args.map(arg => {
        if (typeof arg === 'object') {
            return JSON.stringify(arg, null, 2);
        }
        return String(arg);
    }).join(' ');
    
    if (method === 'error') {
        logEntry.style.color = '#ef4444';
        logEntry.innerHTML = `❌ ${content}`;
    } else {
        logEntry.innerHTML = `> ${content}`;
    }
    
    consoleOutput.appendChild(logEntry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Update cursor position
function updateCursorPosition(textarea) {
    const pos = textarea.selectionStart;
    const lines = textarea.value.substr(0, pos).split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    cursorPosition.textContent = `Ln ${line}, Col ${col}`;
}

// Update editor stats
function updateEditorStats() {
    const activeEditor = document.querySelector('.code-editor.active');
    if (!activeEditor) return;
    
    const text = activeEditor.value;
    const bytes = new Blob([text]).size;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    fileSize.textContent = formatBytes(bytes);
    wordCount.textContent = `${words} শব্দ`;
}

// Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Sync scroll between editors
function syncScroll(e) {
    const scrollTop = e.target.scrollTop;
    document.querySelectorAll('.code-editor').forEach(editor => {
        if (editor !== e.target) {
            editor.scrollTop = scrollTop;
        }
    });
}

// Toggle theme
function toggleTheme() {
    const isDark = themeToggle.checked;
    document.body.style.background = isDark ? '#111827' : '#f9fafb';
    // Add more theme switching logic here
}

// New file
function newFile() {
    if (confirm('একটি নতুন ফাইল তৈরি করবেন? অপরিবর্তিত ডেটা হারিয়ে যাবে।')) {
        htmlEditor.value = '';
        cssEditor.value = '';
        jsEditor.value = '';
        updatePreview();
    }
}

// Show save modal
function showSaveModal() {
    saveModal.classList.add('active');
    document.getElementById('fileName').value = `code_${new Date().toISOString().slice(0,10)}`;
}

// Save file
function saveFile() {
    const fileName = document.getElementById('fileName').value;
    const format = document.getElementById('fileFormat').value;
    
    if (format === 'html') {
        const content = generateCompleteHTML();
        downloadFile(`${fileName}.html`, content);
    } else {
        // Create ZIP with all files
        createZip(fileName);
    }
    
    saveModal.classList.remove('active');
    showNotification('ফাইল সংরক্ষণ করা হয়েছে!');
}

// Generate complete HTML
function generateCompleteHTML() {
    return `<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodePlay এক্সপোর্ট</title>
    <style>${cssEditor.value}</style>
</head>
<body>
    ${htmlEditor.value}
    <script>${jsEditor.value}<\/script>
</body>
</html>`;
}

// Download file
function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Create ZIP
function createZip(fileName) {
    // ZIP creation would require JSZip library
    alert('ZIP তৈরি ফিচার শীঘ্রই আসছে!');
}

// Load file
function loadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            // Parse HTML and extract parts
            const content = event.target.result;
            // This is simplified - in reality you'd need proper parsing
            htmlEditor.value = content;
            updatePreview();
        };
        reader.readAsText(file);
    };
    input.click();
}

// Export files
function exportFiles() {
    const content = generateCompleteHTML();
    downloadFile('codeplay_export.html', content);
}

// Format code
function formatCode() {
    const activeEditor = document.querySelector('.code-editor.active');
    if (!activeEditor) return;
    
    try {
        // Simple formatting - in reality you'd use a proper formatter
        let content = activeEditor.value;
        content = content.replace(/\s+/g, ' ').replace(/> </g, '>\n<');
        activeEditor.value = content;
        updatePreview();
        showNotification('কোড ফরম্যাট করা হয়েছে!');
    } catch (error) {
        showNotification('ফরম্যাট করতে সমস্যা হয়েছে!', 'error');
    }
}

// Undo
function pushToUndoStack() {
    const activeEditor = document.querySelector('.code-editor.active');
    if (!activeEditor) return;
    
    undoStack.push({
        editor: activeEditor.id,
        value: activeEditor.value
    });
    
    // Clear redo stack
    redoStack = [];
}

function undo() {
    if (undoStack.length === 0) return;
    
    const state = undoStack.pop();
    redoStack.push(state);
    
    const editor = document.getElementById(state.editor);
    editor.value = state.value;
    updatePreview();
}

function redo() {
    if (redoStack.length === 0) return;
    
    const state = redoStack.pop();
    undoStack.push(state);
    
    const editor = document.getElementById(state.editor);
    editor.value = state.value;
    updatePreview();
}

// Toggle fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Open in new window
function openInNewWindow() {
    const content = generateCompleteHTML();
    const newWindow = window.open('', '_blank');
    newWindow.document.write(content);
    newWindow.document.close();
}

// Show settings
function showSettings() {
    alert('সেটিংস প্যানেল শীঘ্রই আসছে!');
}

// Auto-save
function startAutoSave() {
    autoSaveTimer = setInterval(() => {
        const data = {
            html: htmlEditor.value,
            css: cssEditor.value,
            js: jsEditor.value,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('codeplay_autosave', JSON.stringify(data));
    }, 30000); // প্রতি ৩০ সেকেন্ডে
}

// Load auto-save
function loadAutoSave() {
    const saved = localStorage.getItem('codeplay_autosave');
    if (saved) {
        const data = JSON.parse(saved);
        htmlEditor.value = data.html;
        cssEditor.value = data.css;
        jsEditor.value = data.js;
        updatePreview();
        showNotification('অটো-সেভ থেকে লোড করা হয়েছে!');
    }
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + S: Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        showSaveModal();
    }
    
    // Ctrl/Cmd + Enter: Run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        updatePreview();
    }
    
    // Ctrl/Cmd + Z: Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    
    // Ctrl/Cmd + Y: Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
    }
    
    // Ctrl/Cmd + N: New
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newFile();
    }
    
    // Ctrl/Cmd + O: Open
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        loadFile();
    }
    
    // Ctrl/Cmd + E: Export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportFiles();
    }
    
    // F11: Fullscreen
    if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Load auto-save on startup
loadAutoSave();

// Initialize
init();
