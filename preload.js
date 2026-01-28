const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Операции с заметками
    getNotes: () => ipcRenderer.invoke('get-notes'),
    saveNote: (data) => ipcRenderer.invoke('save-note', data),
    deleteNote: (name) => ipcRenderer.invoke('delete-note', name),
    renameNote: (data) => ipcRenderer.invoke('rename-note', data),

    // Настройки и темы
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    getThemes: () => ipcRenderer.invoke('get-themes'),

    // Управление окном
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // Редактор тем
    openThemeEditor: () => ipcRenderer.send('open-theme-editor'),
    previewTheme: (themeData) => ipcRenderer.send('theme-preview', themeData),
    exportTheme: (themeData) => ipcRenderer.invoke('export-theme', themeData),
    onApplyPreview: (callback) => ipcRenderer.on('apply-preview', (event, data) => callback(data)),
    selectFont: () => ipcRenderer.invoke('select-font'),
    importTheme: () => ipcRenderer.invoke('import-theme')
});
