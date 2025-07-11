const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger, requestLogger } = require('./logger');
const packageInfo = require('./package.json');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 100 requests per windowMs
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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning'
      ]
    });
    logger.info('🎆 BROWSER INITIALIZED SUCCESSFULLY');
  } catch (error) {
    logger.error('💥 FAILED TO INITIALIZE BROWSER', { error: error.message, stack: error.stack });
  }
}

// Restart browser
async function restartBrowser() {
  try {
    logger.info('🔄 RESTARTING BROWSER');
    if (browser) {
      await browser.close();
    }
    await initBrowser();
    logger.info('✅ BROWSER RESTARTED SUCCESSFULLY');
  } catch (error) {
    logger.error('💥 FAILED TO RESTART BROWSER', { error: error.message, stack: error.stack });
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
async function generatePDF(source, isUrl = false, requestId = null) {
  const startTime = Date.now();
  
  if (!browser) {
    const error = new Error('Browser not initialized');
    logger.error('💥 PDF GENERATION FAILED - BROWSER NOT INITIALIZED', { requestId });
    throw error;
  }

  logger.info('🔄 STARTING PDF GENERATION', { 
    isUrl, 
    sourceLength: isUrl ? source.length : source?.length || 0,
    requestId 
  });

  const page = await browser.newPage();
  
  try {
    if (isUrl) {
      logger.info('🌐 LOADING URL FOR PDF GENERATION', { url: source, requestId });
      await page.goto(source, { waitUntil: 'networkidle2' });
      logger.info('✅ URL LOADED SUCCESSFULLY', { url: source, requestId });
    } else {
      logger.info('📝 SETTING HTML CONTENT FOR PDF GENERATION', { 
        contentLength: source?.length || 0,
        requestId 
      });
      await page.setContent(source, { waitUntil: 'networkidle2' });
      logger.info('✅ HTML CONTENT SET SUCCESSFULLY', { requestId });
    }

    logger.info('⚡ GENERATING PDF', { requestId });
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

    const duration = Date.now() - startTime;
    logger.info('🎯 PDF GENERATION COMPLETED SUCCESSFULLY', { 
      duration: `${duration}ms`,
      pdfSize: pdf.length,
      requestId 
    });

    return pdf;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('💥 PDF GENERATION FAILED', { 
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
      isUrl,
      requestId 
    });
    throw error;
  } finally {
    await page.close();
    logger.debug('🔒 BROWSER PAGE CLOSED', { requestId });
  }
}

// API endpoint for PDF generation
app.post('/api/generate-pdf', async (req, res) => {
  const requestId = req.requestId || generateRequestId();
  const startTime = Date.now();
  
  try {
    const { url, html } = req.body;

    logger.info('📄 PDF GENERATION REQUEST RECEIVED', {
      hasUrl: !!url,
      hasHtml: !!html,
      htmlLength: html?.length || 0,
      requestId
    });

    if (!url && !html) {
      logger.warn('❌ INVALID REQUEST - missing url and html parameters', { requestId });
      return res.status(400).json({
        error: 'Either url or html parameter is required'
      });
    }

    if (url && html) {
      logger.warn('❌ INVALID REQUEST - both url and html provided', { requestId });
      return res.status(400).json({
        error: 'Provide either url or html, not both'
      });
    }

    let pdf;
    if (url) {
      // Validate URL
      try {
        new URL(url);
        logger.info('✅ URL VALIDATION SUCCESSFUL', { url, requestId });
      } catch (error) {
        logger.warn('❌ INVALID URL FORMAT', { url, error: error.message, requestId });
        return res.status(400).json({
          error: 'Invalid URL format'
        });
      }
      pdf = await generatePDF(url, true, requestId);
    } else {
      pdf = await generatePDF(html, false, requestId);
    }

    const duration = Date.now() - startTime;
    logger.info('🎉 PDF GENERATION REQUEST COMPLETED SUCCESSFULLY', {
      duration: `${duration}ms`,
      pdfSize: pdf.length,
      requestId
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(pdf);

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('💥 PDF GENERATION REQUEST FAILED', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
      requestId
    });
    
    // Restart browser on 500 errors to recover from potential browser issues
    try {
      logger.info('🔄 RESTARTING BROWSER DUE TO 500 ERROR', { requestId });
      await restartBrowser();
    } catch (restartError) {
      logger.error('💥 FAILED TO RESTART BROWSER AFTER 500 ERROR', { 
        error: restartError.message,
        requestId 
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: error.message
    });
  }
});

// Generate simple request ID
function generateRequestId() {
  return Math.random().toString(36).substr(2, 9);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    browser: browser ? 'connected' : 'disconnected',
    version: packageInfo.version
  });
});

// Start server
async function startServer() {
  await initBrowser();
  app.listen(PORT, () => {
    logger.info('🚀 SERVER STARTED SUCCESSFULLY', {
      port: PORT,
      healthEndpoint: `http://localhost:${PORT}/health`,
      pdfApiEndpoint: `http://localhost:${PORT}/api/generate-pdf`
    });
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`PDF API: POST http://localhost:${PORT}/api/generate-pdf`);
  });
}

startServer().catch(error => {
  logger.error('💥 FAILED TO START SERVER', {
    error: error.message,
    stack: error.stack
  });
  console.error('Failed to start server:', error);
  process.exit(1);
});