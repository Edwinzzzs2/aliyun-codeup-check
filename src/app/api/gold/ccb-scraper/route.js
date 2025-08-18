import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import https from 'https';
import axios from 'axios';

/**
 * 使用Playwright爬取建设银行黄金价格页面（支持JavaScript渲染）
 * GET /api/gold/ccb-scraper
 */
export async function GET(request) {
  const targetUrl = 'https://gold1.ccb.com/chn/home/gold_new/cpjs/swgjs/flsx/cpxq/index.shtml?PM_PD_ID=261100121&ASPD_ID=12040212&Hdl_InsID=110000000&Org_Inst_Rgon_Cd=BJ';
  
  let browser = null;
  let page = null;
  
  try {
    console.log('开始使用Playwright爬取建设银行黄金价格页面...');
    
    // 启动浏览器
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    // 创建新页面并设置用户代理和视口
    page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    // 设置额外的请求头
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Referer': 'https://gold1.ccb.com/',
    });

    console.log('正在访问页面:', targetUrl);
    
    // 访问页面，等待网络空闲
    await page.goto(targetUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    console.log('页面加载完成，等待价格数据渲染...');
    
    // 等待价格元素出现并有内容
    try {
      await page.waitForFunction(() => {
        const priceElement = document.querySelector('#cpxq_Br_Sell_Prc');
        return priceElement && priceElement.textContent && priceElement.textContent.trim() !== '';
      }, { timeout: 15000 });
      console.log('价格数据已加载');
    } catch (waitError) {
      console.log('等待价格数据超时，继续执行...');
    }

    // 获取页面内容
    const content = await page.content();
    
    // 提取页面标题
    const pageTitle = await page.title();
    console.log('页面标题:', pageTitle);

    // 根据HTML结构优化的价格提取逻辑
    let goldPrices = [];
    let allText = [];
    
    // 1. 首先尝试精确匹配已知的价格元素ID和结构，优先查找.price类名
    const specificPriceSelectors = [
      '.price',             // 优先查找price类名元素
      '#price',             // price ID元素
      '#cpxq_Br_Sell_Prc',  // 品牌卖出价格 (从HTML中发现的实际ID)
      '#cpxq_Er_Sell_Prc',  // 二手卖出价格
      '#cpxq_ASPD_Nm',      // 产品名称相关
      '[id*="cpxq"]',       // 所有cpxq开头的ID
      '[id*="Prc"]',        // 所有包含Prc的ID
      'span[style*="color:#d92c26"]', // 红色价格文字
      'span[style*="color: #d92c26"]', // 红色价格文字（带空格）
      'i[id*="cpxq"]',      // i标签中的价格元素
    ];

    // 提取精确匹配的价格信息
    const emptyPriceElements = []; // 记录找到但为空的价格元素
    
    // 使用Playwright的evaluate方法在浏览器上下文中执行
    const priceExtractionResult = await page.evaluate((selectors) => {
      const goldPrices = [];
      const emptyPriceElements = [];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element, index) => {
          const text = element.textContent ? element.textContent.trim() : '';
          const id = element.id || '';
          const style = element.getAttribute('style') || '';
          const html = element.innerHTML || '';
          
          // 记录所有找到的元素，包括空的
          const elementInfo = {
            selector: selector,
            id: id,
            style: style,
            text: text,
            html: html,
            tagName: element.tagName,
            isEmpty: !text
          };
          
          if (text) {
            // 特殊处理.price类名元素
            if (element.className === 'price' || element.id === 'price') {
              // 从price元素中提取所有数字，特别是价格相关的数字
              const priceNumbers = text.match(/(\d+\.?\d*)/g);
              if (priceNumbers) {
                priceNumbers.forEach(num => {
                  const numValue = parseFloat(num);
                  if (numValue > 100 && numValue < 2000) {
                    goldPrices.push({
                      type: 'price_class_element',
                      ...elementInfo,
                      price: num,
                      unit: '元/克',
                      fullMatch: text,
                      priority: 'high' // 标记为高优先级
                    });
                  }
                });
              }
            }
            
            // 检查是否包含价格模式
            const priceMatch = text.match(/[¥￥]?\s*(\d+\.?\d*)\s*元\/克/);
            if (priceMatch) {
              goldPrices.push({
                type: 'specific_selector',
                ...elementInfo,
                price: priceMatch[1],
                unit: '元/克',
                fullMatch: priceMatch[0]
              });
            } else {
              // 检查是否包含纯数字（可能是价格）
              const numberMatch = text.match(/(\d{2,4}\.?\d{0,2})/);
              if (numberMatch && parseFloat(numberMatch[1]) > 100 && parseFloat(numberMatch[1]) < 2000) {
                goldPrices.push({
                  type: 'potential_price',
                  ...elementInfo,
                  price: numberMatch[1],
                  unit: '推测',
                  fullMatch: numberMatch[0]
                });
              }
            }
          } else if (id.includes('cpxq') && id.includes('Prc')) {
            // 记录空的价格元素（可能需要JavaScript填充）
            emptyPriceElements.push(elementInfo);
          }
        });
      });
      
      return { goldPrices, emptyPriceElements };
    }, specificPriceSelectors);
    
    goldPrices = priceExtractionResult.goldPrices;
    emptyPriceElements.push(...priceExtractionResult.emptyPriceElements);

    // 2. 提取所有可能包含价格的文本（作为备用）
    allText = await page.evaluate(() => {
      const texts = [];
      const elements = document.body.querySelectorAll('*');
      elements.forEach(element => {
        const text = element.textContent ? element.textContent.trim() : '';
        if (text && text.length > 0 && text.length < 200) {
          texts.push(text);
        }
      });
      return texts;
    });

    // 3. 更精确的价格模式匹配
    const pricePatterns = [
      /[¥￥]\s*(\d+\.?\d*)\s*元\/克/g,     // ¥ 787.60元/克
      /(\d+\.?\d*)\s*元\/克/g,            // 787.60元/克
      /价格[：:]\s*[¥￥]?\s*(\d+\.?\d*)/g, // 价格：¥787.60
      /售价[：:]\s*[¥￥]?\s*(\d+\.?\d*)/g, // 售价：¥787.60
      /(\d{3,4}\.\d{1,2})\s*元/g,         // 787.60元
    ];

    // 在所有文本中搜索价格模式（如果精确匹配没有结果）
    if (goldPrices.length === 0) {
      allText.forEach(text => {
        pricePatterns.forEach((pattern, patternIndex) => {
          const matches = [...text.matchAll(pattern)];
          matches.forEach(match => {
            goldPrices.push({
              type: 'pattern_match',
              patternIndex: patternIndex,
              text: text,
              match: match[0],
              price: match[1],
              context: text.substring(Math.max(0, text.indexOf(match[0]) - 20), text.indexOf(match[0]) + match[0].length + 20)
            });
          });
        });
      });
    }

    // 查找表格数据
    const tableData = await page.evaluate(() => {
      const tables = [];
      const tableElements = document.querySelectorAll('table');
      
      tableElements.forEach((table, tableIndex) => {
        const tableInfo = {
          tableIndex: tableIndex,
          rows: []
        };
        
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
          const cells = [];
          const cellElements = row.querySelectorAll('td, th');
          cellElements.forEach((cell, cellIndex) => {
            const cellText = cell.textContent ? cell.textContent.trim() : '';
            if (cellText) {
              cells.push(cellText);
            }
          });
          if (cells.length > 0) {
            tableInfo.rows.push(cells);
          }
        });
        
        if (tableInfo.rows.length > 0) {
          tables.push(tableInfo);
        }
      });
      
      return tables;
    });

    // 4. 查找特定的价格相关元素（扩展搜索）
    const extendedSelectors = [
      '[class*="price"]', '[id*="price"]', '[class*="gold"]', '[id*="gold"]',
      '[id*="cpxq"]', '[class*="fenlei"]', '.price', 'span[style*="color"]',
      'div[class*="detail"]', '[class*="right"]', '[id*="Prc"]'
    ];
    
    const specificElements = await page.evaluate((selectors) => {
      const elements = [];
      
      selectors.forEach(selector => {
        const foundElements = document.querySelectorAll(selector);
        foundElements.forEach((element, index) => {
          const text = element.textContent ? element.textContent.trim() : '';
          const className = element.className || '';
          const id = element.id || '';
          const style = element.getAttribute('style') || '';
          
          if (text) {
            elements.push({
              text: text,
              className: className,
              id: id,
              style: style,
              tagName: element.tagName,
              selector: selector
            });
          }
        });
      });
      
      return elements;
    }, extendedSelectors);

    // 5. 专门查找建设银行页面的价格结构
    const ccbPriceInfo = await page.evaluate(() => {
      const priceElements = [];
      const detailElements = [];
      const scripts = [];

      // 查找所有包含"元/克"的元素
      const allElements = document.querySelectorAll('*');
      allElements.forEach((element, index) => {
        const text = element.textContent ? element.textContent.trim() : '';
        if (text.includes('元/克') || text.includes('¥') || text.includes('￥')) {
          priceElements.push({
            text: text,
            id: element.id || '',
            className: element.className || '',
            style: element.getAttribute('style') || '',
            tagName: element.tagName,
            parent: element.parentElement ? (element.parentElement.className || element.parentElement.id || '') : ''
          });
        }
      });

      // 查找fenlei_detail相关的元素
      const detailSelectors = ['.fenlei_detail_con', '.fenlei_detail_left', '.fenlei_detail_right'];
      detailSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element, index) => {
          const text = element.textContent ? element.textContent.trim() : '';
          if (text) {
            detailElements.push({
              text: text,
              className: element.className || '',
              id: element.id || '',
              html: element.innerHTML
            });
          }
        });
      });

      // 提取页面中的所有脚本内容，可能包含价格数据
      const scriptElements = document.querySelectorAll('script');
      scriptElements.forEach((script, index) => {
        const scriptContent = script.innerHTML;
        if (scriptContent && (scriptContent.includes('price') || scriptContent.includes('金价') || scriptContent.includes('元'))) {
          scripts.push({
            index: index,
            content: scriptContent.substring(0, 500) // 只取前500字符
          });
        }
      });
      
      return { priceElements, detailElements, scripts };
    });
    
    const scripts = ccbPriceInfo.scripts;

    console.log('找到的价格相关信息数量:', goldPrices.length);
    console.log('找到的空价格元素数量:', emptyPriceElements.length);
    console.log('找到的表格数量:', tableData.length);
    console.log('找到的特定元素数量:', specificElements.length);
    console.log('找到的CCB价格元素数量:', ccbPriceInfo.priceElements.length);

    // 输出空价格元素的详细信息
    if (emptyPriceElements.length > 0) {
      console.log('空价格元素详情:');
      emptyPriceElements.forEach((element, index) => {
        console.log(`  ${index + 1}. ID: ${element.id}, 选择器: ${element.selector}, HTML: ${element.html}`);
      });
    }

    // 提取最可能的价格信息，优先显示.price类名的价格
    const extractedPrices = goldPrices.filter(price => 
      price.type === 'specific_selector' || price.type === 'potential_price' || price.type === 'price_class_element' ||
      (price.price && parseFloat(price.price) > 100 && parseFloat(price.price) < 2000)
    );

    // 按优先级排序，price_class_element类型优先
    const sortedPrices = extractedPrices.sort((a, b) => {
      if (a.type === 'price_class_element' && b.type !== 'price_class_element') return -1;
      if (b.type === 'price_class_element' && a.type !== 'price_class_element') return 1;
      return 0;
    });

    // 专门提取.price类名的价格信息
    const priceClassElements = goldPrices.filter(price => price.type === 'price_class_element');

    // 只返回price元素下的价格
    const priceValue = priceClassElements.length > 0 ? 
      parseFloat(priceClassElements[0].price) : null;

    return NextResponse.json({
      success: priceValue !== null,
      price: priceValue
    });

  } catch (error) {
    console.error('爬取建设银行黄金价格失败:', error);
    
    // 详细的错误信息
    let errorDetails = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers
    };

    return NextResponse.json({
      success: false,
      error: '爬取失败',
      details: errorDetails,
      url: targetUrl,
      timestamp: new Date().toISOString(),
      suggestions: [
        '网站可能有反爬虫机制',
        '可能需要登录或验证',
        '页面可能使用JavaScript动态加载内容',
        '建议使用无头浏览器(Puppeteer)或Selenium',
        '检查网络连接和防火墙设置'
      ]
    }, { status: 500 });
  } finally {
    // 确保浏览器资源被正确释放
    try {
      if (page) {
        await page.close();
        console.log('页面已关闭');
      }
      if (browser) {
        await browser.close();
        console.log('浏览器已关闭');
      }
    } catch (cleanupError) {
      console.error('清理资源时出错:', cleanupError);
    }
  }
}

/**
 * 测试不同的爬取策略
 * POST /api/gold/ccb-scraper
 */
export async function POST(request) {
  const { strategy = 'basic' } = await request.json();
  
  const targetUrl = 'https://gold1.ccb.com/chn/home/gold_new/cpjs/swgjs/flsx/cpxq/index.shtml?PM_PD_ID=261100121&ASPD_ID=12040212&Hdl_InsID=110000000&Org_Inst_Rgon_Cd=BJ';
  
  try {
    let config = {
      timeout: 15000,
      maxRedirects: 5
    };

    // 根据策略配置不同的请求头
    switch (strategy) {
      case 'mobile':
        config.headers = {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        };
        break;
      
      case 'curl':
        config.headers = {
          'User-Agent': 'curl/7.68.0',
          'Accept': '*/*',
        };
        break;
      
      case 'minimal':
        config.headers = {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'text/html',
        };
        break;
      
      default: // basic
        config.headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        };
    }

    console.log(`使用策略 ${strategy} 爬取页面...`);
    
    // 添加SSL配置
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
    
    config.httpsAgent = httpsAgent;
    
    const response = await axios.get(targetUrl, config);
    
    return NextResponse.json({
      success: true,
      strategy: strategy,
      status: response.status,
      contentLength: response.data.length,
      contentType: response.headers['content-type'],
      timestamp: new Date().toISOString(),
      preview: response.data.substring(0, 1000) // 返回前1000字符预览
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      strategy: strategy,
      error: error.message,
      status: error.response?.status,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}