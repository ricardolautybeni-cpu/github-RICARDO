const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const { generateInvoice, generateSalesReport, pdfDir } = require('../services/pdf');

const router = express.Router();

// Generar y descargar factura
router.post('/:saleId/generate', authMiddleware, async (req, res) => {
  try {
    const result = await generateInvoice(req.params.saleId);

    // Guardar referencia en BD (opcional)
    await db.query(
      `INSERT INTO generated_documents (id, sale_id, document_type, filename, generated_by) 
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [req.params.saleId, 'invoice', result.filename, req.user.id]
    );

    res.json({
      success: true,
      message: 'Factura generada exitosamente',
      url: result.url
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Descargar factura generada
router.get('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(pdfDir, filename);

    // Validar que el archivo existe y está en el directorio permitido
    if (!fs.existsSync(filepath) || !filepath.startsWith(pdfDir)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    res.download(filepath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generar reporte de ventas
router.post('/reports/generate', authMiddleware, async (req, res) => {
  const { startDate, endDate, format = 'pdf' } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate y endDate requeridos' });
  }

  try {
    const result = await generateSalesReport(startDate, endDate, format);

    if (format === 'json') {
      return res.json(result);
    }

    res.json({
      success: true,
      message: 'Reporte generado exitosamente',
      url: result.url
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
