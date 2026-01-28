/**
 * Логика редактора тем
 */

const inputs = {
    name: document.getElementById('theme-name'),
    background: document.getElementById('color-bg'),
    panel: document.getElementById('color-panel'),
    text: document.getElementById('color-text'),
    accent: document.getElementById('color-accent'),
    border: document.getElementById('color-border'),
    fontFamily: document.getElementById('font-family'),
    fontSize: document.getElementById('font-size')
};

const hexInputs = {
    background: document.getElementById('hex-bg'),
    panel: document.getElementById('hex-panel'),
    text: document.getElementById('hex-text'),
    accent: document.getElementById('hex-accent'),
    border: document.getElementById('hex-border')
};

let customFontData = null;

// Синхронизация Color Picker и HEX input
function setupColorSync(key) {
    const colorPicker = inputs[key];
    const hexInput = hexInputs[key];

    // Инициализация
    hexInput.value = colorPicker.value.toUpperCase();

    colorPicker.addEventListener('input', () => {
        hexInput.value = colorPicker.value.toUpperCase();
        emitPreview();
    });

    hexInput.addEventListener('input', () => {
        let val = hexInput.value;
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            colorPicker.value = val;
            emitPreview();
        }
    });
}

// Настройка всех цветов
Object.keys(hexInputs).forEach(setupColorSync);

// Функция для отправки превью в главное окно
function emitPreview() {
    const themeData = {
        name: inputs.name.value || 'Custom Theme',
        colors: {
            background: inputs.background.value,
            panel: inputs.panel.value,
            text: inputs.text.value,
            accent: inputs.accent.value,
            border: inputs.border.value
        },
        font: {
            family: customFontData ? customFontData.name : inputs.fontFamily.value,
            size: inputs.fontSize.value + 'px',
            customPath: customFontData ? customFontData.path : null
        }
    };
    window.api.previewTheme(themeData);
}

// Слушатели на остальные изменения
inputs.name.addEventListener('input', emitPreview);
inputs.fontFamily.addEventListener('change', () => {
    customFontData = null; // Сброс кастомного шрифта при выборе стандартного
    document.getElementById('custom-font-info').style.display = 'none';
    emitPreview();
});
inputs.fontSize.addEventListener('input', emitPreview);

// Загрузка своего шрифта
document.getElementById('btn-upload-font').onclick = async () => {
    const font = await window.api.selectFont();
    if (font) {
        customFontData = font;
        document.getElementById('font-display-name').textContent = font.name;
        document.getElementById('custom-font-info').style.display = 'block';
        emitPreview();
    }
};

// Сохранение
document.getElementById('btn-save').onclick = async () => {
    const name = inputs.name.value.trim() || 'my-custom-theme';
    const themeData = {
        name: name,
        colors: {
            background: inputs.background.value,
            panel: inputs.panel.value,
            text: inputs.text.value,
            accent: inputs.accent.value,
            border: inputs.border.value
        },
        font: {
            family: customFontData ? customFontData.name : inputs.fontFamily.value,
            size: inputs.fontSize.value + 'px',
            customPath: customFontData ? customFontData.path : null
        }
    };

    await window.api.exportTheme(themeData);
    window.close();
};

// Отмена и сброс
document.getElementById('btn-cancel').onclick = () => {
    window.api.previewTheme(null);
    window.close();
};

document.getElementById('btn-reset').onclick = () => {
    inputs.background.value = '#1a1b26';
    inputs.panel.value = '#24283b';
    inputs.text.value = '#a9b1d6';
    inputs.accent.value = '#7aa2f7';
    inputs.border.value = '#2a2e3a';
    inputs.fontFamily.value = 'system-ui';
    inputs.fontSize.value = '14';
    customFontData = null;
    document.getElementById('custom-font-info').style.display = 'none';

    Object.keys(hexInputs).forEach(key => {
        hexInputs[key].value = inputs[key].value.toUpperCase();
    });

    emitPreview();
};

// Начальное превью
emitPreview();
