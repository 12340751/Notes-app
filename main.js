const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

// Определение путей хранения данных
const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
let dataPath, notesDir, themesDir, fontsDir, settingsPath;

function initPaths() {
    try {
        // В упакованном виде используем %APPDATA%, в разработке - текущую папку
        dataPath = isDev ? __dirname : app.getPath('userData');

        notesDir = path.join(dataPath, 'notes');
        themesDir = path.join(dataPath, 'themes');
        fontsDir = path.join(dataPath, 'fonts');
        settingsPath = path.join(dataPath, 'settings.json');

        console.log('Initializing paths at:', dataPath);

        // Создание необходимых директорий
        [notesDir, themesDir, fontsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log('Created directory:', dir);
            }
        });

        // Копирование тем из ресурсов приложения в userData
        if (!isDev) {
            const internalThemesDir = path.join(__dirname, 'themes');
            if (fs.existsSync(internalThemesDir)) {
                const files = fs.readdirSync(internalThemesDir);
                files.forEach(file => {
                    const dest = path.join(themesDir, file);
                    if (!fs.existsSync(dest)) {
                        fs.copyFileSync(path.join(internalThemesDir, file), dest);
                    }
                });
            }
        }
    } catch (err) {
        console.error('CRITICAL: Failed to initialize paths', err);
        // Как последний шанс - папка в корне пользователя
        dataPath = path.join(os.homedir(), '.notes-manager-fallback');
        if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: 'hidden',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    initPaths();
    createWindow();
});

// --- IPC Обработчики ---

// Работа с заметками
ipcMain.handle('get-notes', async () => {
    const files = fs.readdirSync(notesDir);
    return files
        .filter(file => file.endsWith('.md'))
        .map(file => {
            const content = fs.readFileSync(path.join(notesDir, file), 'utf-8');
            const stats = fs.statSync(path.join(notesDir, file));
            return {
                name: file.replace('.md', ''),
                content: content,
                mtime: stats.mtime
            };
        })
        .sort((a, b) => b.mtime - a.mtime);
});

ipcMain.handle('save-note', async (event, { name, content }) => {
    const filePath = path.join(notesDir, `${name}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
});

ipcMain.handle('delete-note', async (event, name) => {
    const filePath = path.join(notesDir, `${name}.md`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
});

ipcMain.handle('rename-note', async (event, { oldName, newName }) => {
    const oldPath = path.join(notesDir, `${oldName}.md`);
    const newPath = path.join(notesDir, `${newName}.md`);
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        return true;
    }
    return false;
});

// Настройки и темы
ipcMain.handle('get-settings', async () => {
    if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
    return { theme: 'default', mode: 'dark' };
});

ipcMain.handle('save-settings', async (event, settings) => {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
});

ipcMain.handle('get-themes', async () => {
    const files = fs.readdirSync(themesDir);
    return files
        .filter(file => file.endsWith('.json'))
        .map(file => JSON.parse(fs.readFileSync(path.join(themesDir, file), 'utf-8')));
});

// Управление окном
ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    mainWindow.close();
});

// Редактор тем
let themeEditorWindow;
ipcMain.on('open-theme-editor', () => {
    if (themeEditorWindow) {
        themeEditorWindow.focus();
        return;
    }

    themeEditorWindow = new BrowserWindow({
        width: 350,
        height: 600,
        parent: mainWindow,
        modal: false,
        resizable: false,
        title: 'Theme Editor',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    });

    themeEditorWindow.loadFile('theme-editor.html');
    themeEditorWindow.on('closed', () => themeEditorWindow = null);
});

// Проброс превью из редактора в главное окно
ipcMain.on('theme-preview', (event, themeData) => {
    mainWindow.webContents.send('apply-preview', themeData);
});

// Экспорт темы на рабочий стол
ipcMain.handle('export-theme', async (event, themeData) => {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const fileName = `${themeData.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    const filePath = path.join(desktopPath, fileName);

    // Сохраняем на рабочий стол
    fs.writeFileSync(filePath, JSON.stringify(themeData, null, 2), 'utf-8');

    // Также сохраняем в папку тем, чтобы она сразу появилась в списке
    const internalPath = path.join(themesDir, fileName);
    fs.writeFileSync(internalPath, JSON.stringify(themeData, null, 2), 'utf-8');

    return true;
});

// Выбор и загрузка шрифта
ipcMain.handle('select-font', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fileName = path.basename(filePath);
        const destPath = path.join(fontsDir, fileName);
        fs.copyFileSync(filePath, destPath);

        // Возвращаем имя шрифта (без расширения) и относительный путь
        const fontName = path.parse(fileName).name;
        return { name: fontName, path: `fonts/${fileName}` };
    }
    return null;
});

// Импорт темы из файла
ipcMain.handle('import-theme', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Theme JSON', extensions: ['json'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const themeData = JSON.parse(content);

            // Проверка структуры (минимум наличие имени)
            if (!themeData.name) throw new Error('Invalid theme format');

            const fileName = path.basename(filePath);
            const destPath = path.join(themesDir, fileName);
            fs.copyFileSync(filePath, destPath);

            return themeData;
        } catch (e) {
            console.error('Import error:', e);
            throw e;
        }
    }
    return null;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
