/**
 * Логика отрисовки и взаимодействия (Renderer Process)
 */

let currentNote = null;
let allNotes = [];
let themes = [];
let settings = { theme: 'default', mode: 'dark' };

// DOM Элементы
const notesListEl = document.getElementById('notes-list');
const noteTitleInput = document.getElementById('note-title');
const markdownInput = document.getElementById('markdown-input');
const markdownPreview = document.getElementById('markdown-preview');
const searchInput = document.getElementById('search-input');
const newNoteBtn = document.getElementById('new-note-btn');
const deleteNoteBtn = document.getElementById('delete-note-btn');
const themeSelect = document.getElementById('theme-select');
const modeToggle = document.getElementById('mode-toggle');

// --- Инициализация ---

async function init() {
    // Загружаем настройки и темы
    settings = await window.api.getSettings();
    themes = await window.api.getThemes();

    // Заполняем список тем
    themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.name;
        option.textContent = theme.name;
        themeSelect.appendChild(option);
    });
    themeSelect.value = settings.theme;

    // Применяем тему и режим
    applyTheme(settings.theme);
    applyMode(settings.mode);

    // Загружаем заметки
    await refreshNotesList();

    // Слушатели событий
    setupEventListeners();
}

// --- Функции управления заметками ---

async function refreshNotesList() {
    allNotes = await window.api.getNotes();
    renderNotes(allNotes);
}

function renderNotes(notes) {
    notesListEl.innerHTML = '';
    notes.forEach(note => {
        const li = document.createElement('li');
        li.className = `note-item ${currentNote && currentNote.name === note.name ? 'active' : ''}`;
        li.innerHTML = `
            <span class="note-name">${note.name}</span>
            <span class="note-date">${new Date(note.mtime).toLocaleDateString()}</span>
        `;
        li.onclick = () => selectNote(note);
        notesListEl.appendChild(li);
    });
}

function selectNote(note) {
    currentNote = note;
    noteTitleInput.value = note.name;
    noteTitleInput.readOnly = false;
    markdownInput.value = note.content;
    updatePreview();

    // Подсветка активной заметки в списке
    document.querySelectorAll('.note-item').forEach(el => {
        el.classList.toggle('active', el.querySelector('.note-name').textContent === note.name);
    });
}

async function createNewNote() {
    const name = `Заметка ${allNotes.length + 1}`;
    const content = `# ${name}\n\nНачни писать здесь...`;
    await window.api.saveNote({ name, content });
    await refreshNotesList();

    // Автоматически выбираем новую заметку
    const newNote = allNotes.find(n => n.name === name);
    if (newNote) selectNote(newNote);
}

async function deleteCurrentNote() {
    if (!currentNote) return;
    if (confirm(`Удалить заметку "${currentNote.name}"?`)) {
        await window.api.deleteNote(currentNote.name);
        currentNote = null;
        noteTitleInput.value = '';
        noteTitleInput.readOnly = true;
        markdownInput.value = '';
        markdownPreview.innerHTML = '';
        await refreshNotesList();
    }
}

// --- Рендеринг и Сохранение ---

function updatePreview() {
    const content = markdownInput.value;
    // marked подключен через CDN в index.html
    markdownPreview.innerHTML = marked.parse(content);
}

let saveTimeout;
function autoSave() {
    if (!currentNote) return;

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        const content = markdownInput.value;
        await window.api.saveNote({ name: currentNote.name, content });
        currentNote.content = content;
        console.log('Saved:', currentNote.name);
    }, 1000); // Сохранение через 1 секунду после окончания ввода
}

// --- Поиск ---

function filterNotes() {
    const query = searchInput.value.toLowerCase();
    const filtered = allNotes.filter(note =>
        note.name.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
    );
    renderNotes(filtered);
}

// --- Темы и Режимы ---

function applyMode(mode) {
    settings.mode = mode;
    document.body.className = mode === 'light' ? 'light-mode' : 'dark-mode';
    window.api.saveSettings(settings);
}

function applyTheme(themeName) {
    settings.theme = themeName;
    const theme = themes.find(t => t.name === themeName);
    applyThemeData(theme);
    window.api.saveSettings(settings);
}

function applyThemeData(theme) {
    const root = document.documentElement;
    if (theme) {
        // Поддержка обеих структур (старой и новой)
        const colors = theme.colors || theme;
        if (colors.background) root.style.setProperty('--bg-color', colors.background);
        if (colors.panel) root.style.setProperty('--panel-color', colors.panel);
        if (colors.text) root.style.setProperty('--text-color', colors.text);
        if (colors.accent) root.style.setProperty('--accent-color', colors.accent);
        if (colors.border) root.style.setProperty('--border-color', colors.border);

        // Шрифты
        if (theme.font) {
            if (theme.font.customPath) {
                // Динамическая инъекция шрифта
                let fontFaceStyle = document.getElementById('dynamic-font-face');
                if (!fontFaceStyle) {
                    fontFaceStyle = document.createElement('style');
                    fontFaceStyle.id = 'dynamic-font-face';
                    document.head.appendChild(fontFaceStyle);
                }
                fontFaceStyle.textContent = `
                    @font-face {
                        font-family: '${theme.font.family}';
                        src: url('${theme.font.customPath}');
                    }
                `;
            }
            if (theme.font.family) root.style.setProperty('--font-family', theme.font.family);
            if (theme.font.size) root.style.setProperty('--font-size', theme.font.size);
        }
    } else {
        root.style.removeProperty('--bg-color');
        root.style.removeProperty('--panel-color');
        root.style.removeProperty('--text-color');
        root.style.removeProperty('--accent-color');
        root.style.removeProperty('--border-color');
        root.style.removeProperty('--font-family');
        root.style.removeProperty('--font-size');
        const fontFaceStyle = document.getElementById('dynamic-font-face');
        if (fontFaceStyle) fontFaceStyle.remove();
    }
}

// --- Слушатели событий ---

function setupEventListeners() {
    newNoteBtn.onclick = createNewNote;
    deleteNoteBtn.onclick = deleteCurrentNote;

    markdownInput.oninput = () => {
        updatePreview();
        autoSave();
    };

    searchInput.oninput = filterNotes;

    modeToggle.onclick = () => {
        const newMode = settings.mode === 'dark' ? 'light' : 'dark';
        applyMode(newMode);
    };

    themeSelect.onchange = (e) => {
        applyTheme(e.target.value);
    };

    document.getElementById('open-editor-btn').onclick = () => {
        window.api.openThemeEditor();
    };

    document.getElementById('import-theme-btn').onclick = async () => {
        try {
            const importedTheme = await window.api.importTheme();
            if (importedTheme) {
                // Полная перезагрузка тем из папки
                themes = await window.api.getThemes();

                // Обновляем select
                themeSelect.innerHTML = '<option value="default">Default Theme</option>';
                themes.forEach(theme => {
                    const option = document.createElement('option');
                    option.value = theme.name;
                    option.textContent = theme.name;
                    themeSelect.appendChild(option);
                });

                // Сразу применяем новую тему
                themeSelect.value = importedTheme.name;
                applyTheme(importedTheme.name);
                alert(`Тема "${importedTheme.name}" успешно импортирована!`);
            }
        } catch (err) {
            alert('Ошибка при импорте темы. Проверьте формат файла.');
        }
    };

    // Слушаем превью из редактора
    window.api.onApplyPreview((themeData) => {
        if (themeData) {
            applyThemeData(themeData);
        } else {
            applyTheme(settings.theme); // Возврат к текущей теме при отмене
        }
    });

    // Управление окном
    document.getElementById('win-min').onclick = () => window.api.minimize();
    document.getElementById('win-max').onclick = () => window.api.maximize();
    document.getElementById('win-close').onclick = () => window.api.close();

    // Переименование заметки
    noteTitleInput.onblur = async () => {
        if (!currentNote || noteTitleInput.value === currentNote.name) return;

        const newName = noteTitleInput.value.trim();
        if (newName && !allNotes.some(n => n.name === newName)) {
            await window.api.renameNote({ oldName: currentNote.name, newName });
            currentNote.name = newName;
            await refreshNotesList();
        } else {
            noteTitleInput.value = currentNote.name;
        }
    };
}

// Запуск
init();
