document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settingsForm');
    const apiKeyInput = document.getElementById('apiKey');
    const testBtn = document.getElementById('testBtn');
    const statusDiv = document.getElementById('status');
    
    await loadSettings();
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });
    
    testBtn.addEventListener('click', async () => {
        await testConnection();
    });
    
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['openaiApiKey']);
            if (result.openaiApiKey) {
                apiKeyInput.value = result.openaiApiKey;
            }
        } catch (error) {
            showStatus('設定の読み込みに失敗しました', 'error');
        }
    }
    
    async function saveSettings() {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('APIキーを入力してください', 'error');
            return;
        }
        
        if (!apiKey.startsWith('sk-')) {
            showStatus('正しいAPIキーの形式ではありません（sk-で始まる必要があります）', 'error');
            return;
        }
        
        try {
            await chrome.storage.sync.set({ openaiApiKey: apiKey });
            showStatus('設定が保存されました', 'success');
        } catch (error) {
            showStatus('設定の保存に失敗しました', 'error');
        }
    }
    
    async function testConnection() {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('APIキーを入力してください', 'error');
            return;
        }
        
        testBtn.disabled = true;
        testBtn.textContent = 'テスト中...';
        
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            
            if (response.ok) {
                showStatus('✅ APIキーが正常に動作しています', 'success');
            } else {
                const error = await response.json();
                showStatus(`❌ API接続エラー: ${error.error?.message || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            showStatus(`❌ 接続テストに失敗しました: ${error.message}`, 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = '接続テスト';
        }
    }
    
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
});