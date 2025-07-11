const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

// Test HTML to PDF conversion
async function testHtmlToPdf() {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test PDF</title>
          <style>
            body { 
              font-family: "Noto Sans CJK SC", "WenQuanYi Zen Hei", "Microsoft YaHei", Arial, sans-serif; 
              margin: 20px; 
            }
            h1 { color: #333; }
            .content { background: #f5f5f5; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>HTML to PDF 测试</h1>
          <div class="content">
            <p>这是一个从HTML内容生成的测试文档。</p>
            <p>中文字体测试：你好世界！</p>
            <p>English: This is a test document generated from HTML content.</p>
            <p>当前时间: ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    const response = await axios.post(`${BASE_URL}/api/generate-pdf`, {
      html: htmlContent
    }, {
      responseType: 'arraybuffer'
    });

    fs.writeFileSync('test-html.pdf', response.data);
    console.log('✓ HTML to PDF test completed - saved as test-html.pdf');
  } catch (error) {
    console.error('✗ HTML to PDF test failed:', error.message);
  }
}

// Test URL to PDF conversion
async function testUrlToPdf() {
  try {
    const response = await axios.post(`${BASE_URL}/api/generate-pdf`, {
      url: 'https://example.com'
    }, {
      responseType: 'arraybuffer'
    });

    fs.writeFileSync('test-url.pdf', response.data);
    console.log('✓ URL to PDF test completed - saved as test-url.pdf');
  } catch (error) {
    console.error('✗ URL to PDF test failed:', error.message);
  }
}

// Test health endpoint
async function testHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✓ Health check passed:', response.data);
  } catch (error) {
    console.error('✗ Health check failed:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('Running PDF service tests...\n');
  
  await testHealth();
  await testHtmlToPdf();
  await testUrlToPdf();
  
  console.log('\nAll tests completed!');
}

// Only run if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testHtmlToPdf,
  testUrlToPdf,
  testHealth
};