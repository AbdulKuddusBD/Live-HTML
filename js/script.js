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
