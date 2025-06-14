function extractStockData() {
  const stockSection = document.querySelector('#portfolio_det_eq');
  if (!stockSection) return null;

  const totalElement = stockSection.querySelector('.heading-small');
  const totalText = totalElement ? totalElement.textContent.trim() : '';
  const totalMatch = totalText.match(/合計：([\d,]+)円/);
  const total = totalMatch ? totalMatch[1].replace(/,/g, '') : '';

  const stocks = [];
  const stockRows = stockSection.querySelectorAll('table tbody tr');
  
  stockRows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 11) {
      const stock = {
        code: cells[0].textContent.trim(),
        name: cells[1].textContent.trim(),
        quantity: cells[2].textContent.trim().replace(/,/g, ''),
        averagePrice: cells[3].textContent.trim().replace(/,/g, ''),
        currentPrice: cells[4].textContent.trim().replace(/,/g, ''),
        marketValue: cells[5].textContent.trim().replace(/[円,]/g, ''),
        dailyChange: cells[6].textContent.trim().replace(/[円,]/g, ''),
        profitLoss: cells[7].textContent.trim().replace(/[円,]/g, ''),
        profitLossRate: cells[8].textContent.trim().replace('%', ''),
        broker: cells[9].textContent.trim(),
        acquisitionDate: cells[10].textContent.trim()
      };
      stocks.push(stock);
    }
  });

  return {
    type: 'stocks',
    total: total,
    items: stocks
  };
}

function extractMutualFundData() {
  const mfSection = document.querySelector('#portfolio_det_mf');
  if (!mfSection) return null;

  const totalElement = mfSection.querySelector('.heading-small');
  const totalText = totalElement ? totalElement.textContent.trim() : '';
  const totalMatch = totalText.match(/合計：([\d,]+)円/);
  const total = totalMatch ? totalMatch[1].replace(/,/g, '') : '';

  const funds = [];
  const fundRows = mfSection.querySelectorAll('table tbody tr');
  
  fundRows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 10) {
      const fund = {
        name: cells[0].textContent.trim(),
        quantity: cells[1].textContent.trim().replace(/,/g, ''),
        averagePrice: cells[2].textContent.trim().replace(/,/g, ''),
        basePrice: cells[3].textContent.trim().replace(/,/g, ''),
        marketValue: cells[4].textContent.trim().replace(/[円,]/g, ''),
        dailyChange: cells[5].textContent.trim().replace(/[円,]/g, ''),
        profitLoss: cells[6].textContent.trim().replace(/[円,]/g, ''),
        profitLossRate: cells[7].textContent.trim().replace('%', ''),
        broker: cells[8].textContent.trim(),
        acquisitionDate: cells[9].textContent.trim()
      };
      funds.push(fund);
    }
  });

  return {
    type: 'mutual_funds',
    total: total,
    items: funds
  };
}

function extractAllPortfolioData() {
  const stockData = extractStockData();
  const mfData = extractMutualFundData();
  
  const portfolioData = {
    timestamp: new Date().toISOString(),
    stocks: stockData,
    mutualFunds: mfData
  };

  chrome.storage.local.set({ portfolioData: portfolioData });
  
  return portfolioData;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Content script is ready' });
    return true;
  }
  
  if (request.action === 'extractData') {
    try {
      const data = extractAllPortfolioData();
      console.log('Data extracted successfully:', data);
      sendResponse({ success: true, data: data });
    } catch (error) {
      console.error('Error extracting data:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('MoneyForward Portfolio Auditor: Content script loaded');
  });
} else {
  console.log('MoneyForward Portfolio Auditor: Content script loaded');
}