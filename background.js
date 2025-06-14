chrome.action.onClicked.addListener(async (tab) => {
  const portfolioUrl = 'https://moneyforward.com/bs/portfolio';
  
  try {
    if (tab.url && tab.url.includes('moneyforward.com/bs/portfolio')) {
      return;
    }
    
    await chrome.tabs.create({ url: portfolioUrl });
  } catch (error) {
    console.error('Failed to open MoneyForward portfolio page:', error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateReport') {
    generateAnalysisReport(request.data)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function generateAnalysisReport(portfolioData) {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI APIキーが設定されていません。オプションページで設定してください。');
    }

    const prompt = createAnalysisPrompt(portfolioData);
    const analysis = await callOpenAI(apiKey, prompt);
    
    const reportUrl = await createReportTab(analysis, portfolioData);
    
    return { success: true, reportUrl: reportUrl };
  } catch (error) {
    console.error('Report generation failed:', error);
    return { success: false, error: error.message };
  }
}

async function getApiKey() {
  const result = await chrome.storage.sync.get(['openaiApiKey']);
  return result.openaiApiKey;
}

function createAnalysisPrompt(data) {
  const equities = data.stocks ? data.stocks.items : [];
  const funds = data.mutualFunds ? data.mutualFunds.items : [];
  
  return `
あなたは経験豊富な投資アドバイザーです。以下のポートフォリオデータについて、3つの異なる投資スタンスから分析・提言を行ってください。

【ポートフォリオデータ】
株式（現物）合計: ${data.stocks ? data.stocks.total : 0}円
株式銘柄数: ${equities.length}銘柄

投資信託合計: ${data.mutualFunds ? data.mutualFunds.total : 0}円
投資信託銘柄数: ${funds.length}銘柄

【株式詳細】
${equities.map(stock => 
  `${stock.code} ${stock.name}: 保有${stock.quantity}株, 評価額${stock.marketValue}円, 評価損益${stock.profitLoss}円(${stock.profitLossRate}%)`
).join('\n')}

【投資信託詳細】
${funds.map(fund => 
  `${fund.name}: 保有${fund.quantity}口, 評価額${fund.marketValue}円, 評価損益${fund.profitLoss}円(${fund.profitLossRate}%)`
).join('\n')}

以下の3つの投資スタンスから、それぞれ独立した分析・提言を提供してください：

## 1. 慎重派（リスク回避重視）
- 損失リスクを最小限に抑えることを重視
- 安定性と元本保護を優先
- 具体的な売却・保持・追加購入の提案

## 2. バランス派（リスクと収益のバランス）
- リスクと収益のバランスを重視
- 分散投資によるリスク軽減
- 具体的なリバランス提案

## 3. 攻め派（高収益狙い）
- 高いリターンを求める積極的な投資
- リスクを取った成長戦略
- 具体的な投資機会の提案

各スタンスについて以下の項目を含めてください：
- 現在のポートフォリオの評価
- 個別銘柄への提言（売却/保持/追加購入）
- 全体的な資産配分の改善提案
- 今後の投資戦略

回答はHTMLフォーマットで、見やすい形式でお願いします。
`;
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'あなたは専門的な投資アドバイザーです。日本の投資家向けに実用的なアドバイスを提供してください。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

async function createReportTab(analysis, portfolioData) {
  const reportHtml = generateReportHtml(analysis, portfolioData);
  const blob = new Blob([reportHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const tab = await chrome.tabs.create({ url: url });
  return tab.url;
}

function generateReportHtml(analysis, portfolioData) {
  const timestamp = new Date().toLocaleString('ja-JP');
  
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ポートフォリオ分析レポート</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
        }
        .summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }
        .summary-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .analysis-section {
            background: white;
            padding: 25px;
            margin-bottom: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid #007bff;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        .timestamp {
            text-align: right;
            color: #666;
            font-size: 0.9em;
            margin-top: 20px;
        }
        @media print {
            body { max-width: none; margin: 0; }
            .header { background: #667eea !important; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>💼 ポートフォリオ分析レポート</h1>
        <p>MoneyForward Portfolio Auditor による自動生成レポート</p>
    </div>
    
    <div class="summary">
        <h2>📊 ポートフォリオサマリー</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <h3>株式（現物）</h3>
                <p><strong>${portfolioData.stocks ? portfolioData.stocks.total.toLocaleString() : 0}円</strong></p>
                <p>${portfolioData.stocks ? portfolioData.stocks.items.length : 0}銘柄</p>
            </div>
            <div class="summary-item">
                <h3>投資信託</h3>
                <p><strong>${portfolioData.mutualFunds ? portfolioData.mutualFunds.total.toLocaleString() : 0}円</strong></p>
                <p>${portfolioData.mutualFunds ? portfolioData.mutualFunds.items.length : 0}銘柄</p>
            </div>
            <div class="summary-item">
                <h3>総資産</h3>
                <p><strong>${((portfolioData.stocks ? parseInt(portfolioData.stocks.total) : 0) + (portfolioData.mutualFunds ? parseInt(portfolioData.mutualFunds.total) : 0)).toLocaleString()}円</strong></p>
            </div>
        </div>
    </div>
    
    <div class="analysis-section">
        ${analysis}
    </div>
    
    <div class="timestamp">
        レポート生成日時: ${timestamp}
    </div>
</body>
</html>
  `;
}