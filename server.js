const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Global browser instance
let browser;

// Initialize browser
async function initBrowser() {
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Browser initialized');
  } catch (error) {
    console.error('Failed to initialize browser:', error);
  }
}

// Close browser on exit
process.on('exit', async () => {
  if (browser) {
    await browser.close();
  }
});

process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// PDF generation function
async function generatePDF(source, isUrl = false) {
  if (!browser) {
    throw new Error('Browser not initialized');
  }

  const page = await browser.newPage();
  
  try {
    if (isUrl) {
      await page.goto(source, { waitUntil: 'networkidle2' });
    } else {
      await page.setContent(source, { waitUntil: 'networkidle2' });
    }

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        bottom: '1cm',
        left: '1cm',
        right: '1cm'
      }
    });

    return pdf;
  } finally {
    await page.close();
  }
}

// API endpoint for PDF generation
app.post('/api/generate-pdf', async (req, res) => {
  try {
    const { url, html } = req.body;

    if (!url && !html) {
      return res.status(400).json({ 
        error: 'Either url or html parameter is required' 
      });
    }

    if (url && html) {
      return res.status(400).json({ 
        error: 'Provide either url or html, not both' 
      });
    }

    let pdf;
    if (url) {
      // Validate URL
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ 
          error: 'Invalid URL format' 
        });
      }
      pdf = await generatePDF(url, true);
    } else {
      pdf = await generatePDF(html, false);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(pdf);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    browser: browser ? 'connected' : 'disconnected'
  });
});

// Start server
async function startServer() {
  await initBrowser();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`PDF API: POST http://localhost:${PORT}/api/generate-pdf`);
  });
}

startServer().catch(console.error);