# HTML to PDF Service

一个基于 Node.js 的 HTML/URL 转 PDF 服务，支持通过 POST 请求将网页 URL 或 HTML 源码转换为 PDF 文件。

## 功能特性

- **URL转PDF**：输入网页URL，返回PDF文件
- **HTML源码转PDF**：输入HTML代码，返回PDF文件
- **安全防护**：包含Helmet、CORS、速率限制等安全措施
- **错误处理**：完善的错误处理和输入验证
- **健康检查**：提供健康检查端点

## 技术栈

- **Node.js** - 运行环境
- **Express.js** - Web框架
- **Puppeteer** - 无头浏览器，用于PDF生成
- **Helmet** - 安全中间件
- **CORS** - 跨域资源共享
- **Express Rate Limit** - 请求速率限制

## 安装

```bash
npm install
```

## 使用方法

### 1. 启动服务

```bash
npm start
```

服务将运行在端口 3000，访问 http://localhost:3000

### 2. API 端点

#### POST /api/generate-pdf

**请求参数**：
- `url` (string, 可选) - 要转换的网页URL
- `html` (string, 可选) - 要转换的HTML源码

**注意**：`url` 和 `html` 参数二选一，不能同时提供。

**响应**：返回生成的PDF文件

#### GET /health

健康检查端点，返回服务状态信息。

### 3. API 调用示例

#### URL转PDF

```bash
curl -X POST http://localhost:3000/api/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' \
  --output document.pdf
```

#### HTML转PDF

```bash
curl -X POST http://localhost:3000/api/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Hello World</h1><p>This is a test document.</p>"}' \
  --output document.pdf
```

#### JavaScript 示例

```javascript
// URL转PDF
const response = await fetch('http://localhost:3000/api/generate-pdf', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://example.com'
  })
});

const pdfBuffer = await response.arrayBuffer();
```

```javascript
// HTML转PDF
const htmlContent = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Test PDF</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
      </style>
    </head>
    <body>
      <h1>HTML to PDF Test</h1>
      <p>This is a test document.</p>
    </body>
  </html>
`;

const response = await fetch('http://localhost:3000/api/generate-pdf', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    html: htmlContent
  })
});

const pdfBuffer = await response.arrayBuffer();
```

### 4. 测试服务

运行测试脚本：

```bash
node test.js
```

测试脚本将会：
- 检查服务健康状态
- 测试 HTML 转 PDF 功能
- 测试 URL 转 PDF 功能
- 生成测试PDF文件

## 文件结构

```
HtmlToPDF/
├── README.md           # 项目说明文档
├── package.json        # 项目依赖配置
├── server.js          # 主服务文件
├── test.js            # 测试文件
└── CLAUDE.md          # 开发配置
```

## 配置选项

### 环境变量

- `PORT` - 服务端口号 (默认: 3000)

### PDF 生成配置

PDF 生成使用以下默认配置：
- 格式: A4
- 边距: 1cm (上下左右)
- 打印背景: 启用
- 等待条件: networkidle2

## 安全特性

- **Helmet**: 设置各种HTTP头部以增强安全性
- **CORS**: 配置跨域资源共享
- **Rate Limiting**: 限制每IP每15分钟最多100个请求
- **请求大小限制**: 限制请求体大小为10MB
- **URL验证**: 验证输入URL的格式

## 错误处理

服务包含完善的错误处理：
- 输入验证错误 (400)
- 服务器内部错误 (500)
- 速率限制错误 (429)
- 详细的错误信息返回

## 许可证

ISC