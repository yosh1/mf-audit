document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const statusTextEl = document.getElementById('statusText');
  const extractBtn = document.getElementById('extractBtn');
  const generateReportBtn = document.getElementById('generateReportBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const dataSummaryEl = document.getElementById('dataSummary');
  
  async function checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('moneyforward.com')) {
        statusEl.className = 'status error';
        statusTextEl.textContent = 'MoneyForwardのページで使用してください';
        return false;
      }
      
      statusEl.className = 'status ready';
      statusTextEl.textContent = 'データ抽出準備完了';
      extractBtn.disabled = false;
      return true;
    } catch (error) {
      statusEl.className = 'status error';
      statusTextEl.textContent = 'エラーが発生しました';
      return false;
    }
  }
  
  async function loadStoredData() {
    try {
      const result = await chrome.storage.local.get(['portfolioData']);
      if (result.portfolioData) {
        updateDataSummary(result.portfolioData);
        exportCsvBtn.disabled = false;
        exportJsonBtn.disabled = false;
        generateReportBtn.disabled = false;
      }
    } catch (error) {
      console.error('Failed to load stored data:', error);
    }
  }
  
  function updateDataSummary(data) {
    const stockCount = data.stocks ? data.stocks.items.length : 0;
    const fundCount = data.mutualFunds ? data.mutualFunds.items.length : 0;
    const lastUpdate = new Date(data.timestamp).toLocaleString('ja-JP');
    
    document.getElementById('stockCount').textContent = stockCount;
    document.getElementById('fundCount').textContent = fundCount;
    document.getElementById('lastUpdate').textContent = lastUpdate;
    dataSummaryEl.style.display = 'block';
  }
  
  extractBtn.addEventListener('click', async () => {
    try {
      extractBtn.disabled = true;
      extractBtn.textContent = '抽出中...';
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on MoneyForward page
      if (!tab.url.includes('moneyforward.com')) {
        statusEl.className = 'status error';
        statusTextEl.textContent = 'MoneyForwardのページで使用してください';
        return;
      }
      
      // Try to inject content script if not already present
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // Wait a bit for content script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (injectionError) {
        console.log('Content script may already be injected');
      }
      
      // Test if content script is responsive with ping
      let isConnected = false;
      try {
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        isConnected = pingResponse && pingResponse.success;
      } catch (pingError) {
        console.log('Content script not responsive, will reload page');
      }
      
      if (!isConnected) {
        // Reload page and inject content script
        await chrome.tabs.reload(tab.id);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page reload
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
      
      if (response && response.success) {
        updateDataSummary(response.data);
        exportCsvBtn.disabled = false;
        exportJsonBtn.disabled = false;
        generateReportBtn.disabled = false;
        statusTextEl.textContent = 'データ抽出完了';
      } else {
        statusEl.className = 'status error';
        statusTextEl.textContent = 'データ抽出に失敗しました';
      }
    } catch (error) {
      statusEl.className = 'status error';
      if (error.message.includes('Could not establish connection')) {
        statusTextEl.textContent = 'ページを再読み込みしてから再試行してください';
      } else {
        statusTextEl.textContent = 'エラーが発生しました';
      }
      console.error('Extract error:', error);
    } finally {
      extractBtn.disabled = false;
      extractBtn.textContent = 'データを抽出';
    }
  });
  
  generateReportBtn.addEventListener('click', async () => {
    try {
      generateReportBtn.disabled = true;
      generateReportBtn.textContent = 'レポート生成中...';
      
      const result = await chrome.storage.local.get(['portfolioData']);
      if (!result.portfolioData) {
        statusEl.className = 'status error';
        statusTextEl.textContent = 'まずデータを抽出してください';
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateReport',
        data: result.portfolioData
      });
      
      if (response && response.success) {
        statusTextEl.textContent = 'レポートが生成されました';
      } else {
        statusEl.className = 'status error';
        statusTextEl.textContent = response.error || 'レポート生成に失敗しました';
      }
    } catch (error) {
      statusEl.className = 'status error';
      statusTextEl.textContent = 'エラーが発生しました';
      console.error('Report generation error:', error);
    } finally {
      generateReportBtn.disabled = false;
      generateReportBtn.textContent = '分析レポート生成';
    }
  });
  
  exportCsvBtn.addEventListener('click', async () => {
    try {
      const result = await chrome.storage.local.get(['portfolioData']);
      if (result.portfolioData) {
        const csv = convertToCSV(result.portfolioData);
        downloadFile(csv, 'portfolio-data.csv', 'text/csv');
      }
    } catch (error) {
      console.error('CSV export error:', error);
    }
  });
  
  exportJsonBtn.addEventListener('click', async () => {
    try {
      const result = await chrome.storage.local.get(['portfolioData']);
      if (result.portfolioData) {
        const json = JSON.stringify(result.portfolioData, null, 2);
        downloadFile(json, 'portfolio-data.json', 'application/json');
      }
    } catch (error) {
      console.error('JSON export error:', error);
    }
  });
  
  function convertToCSV(data) {
    let csv = '';
    
    if (data.stocks && data.stocks.items.length > 0) {
      csv += '=== 株式 ===\n';
      csv += '銘柄コード,銘柄名,保有数,平均取得単価,現在値,評価額,前日比,評価損益,評価損益率,保有金融機関,取得日\n';
      
      data.stocks.items.forEach(stock => {
        csv += `${stock.code},${stock.name},${stock.quantity},${stock.averagePrice},${stock.currentPrice},${stock.marketValue},${stock.dailyChange},${stock.profitLoss},${stock.profitLossRate},${stock.broker},${stock.acquisitionDate}\n`;
      });
      
      csv += '\n';
    }
    
    if (data.mutualFunds && data.mutualFunds.items.length > 0) {
      csv += '=== 投資信託 ===\n';
      csv += '銘柄名,保有数,平均取得単価,基準価額,評価額,前日比,評価損益,評価損益率,保有金融機関,取得日\n';
      
      data.mutualFunds.items.forEach(fund => {
        csv += `${fund.name},${fund.quantity},${fund.averagePrice},${fund.basePrice},${fund.marketValue},${fund.dailyChange},${fund.profitLoss},${fund.profitLossRate},${fund.broker},${fund.acquisitionDate}\n`;
      });
    }
    
    return csv;
  }
  
  function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  await checkCurrentTab();
  await loadStoredData();
});