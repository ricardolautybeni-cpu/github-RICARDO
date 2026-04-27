const express = require('express');
const authMiddleware = require('../middleware/auth');
const { predictStockOut, analyzeInventoryRisk } = require('../services/inventoryPredictor');

const router = express.Router();

/**
 * GET /api/predictions/product/:productId
 * Predecir cuándo se agotará un producto
 */
router.get('/product/:productId', authMiddleware, async (req, res) => {
  const { lookbackDays = 30 } = req.query;

  try {
    const prediction = await predictStockOut(req.params.productId, parseInt(lookbackDays));
    res.json(prediction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/predictions/risk-analysis
 * Análisis de riesgo de inventario: productos próximos a agotarse
 */
router.get('/risk-analysis', authMiddleware, async (req, res) => {
  try {
    const analysis = await analyzeInventoryRisk();

    res.json({
      analysis,
      summary: {
        message: analysis.urgentAlerts > 0
          ? `🚨 ${analysis.urgentAlerts} producto(s) en riesgo CRÍTICO`
          : `✅ ${analysis.totalAlerts} alerta(s) de inventario`,
        actionRequired: analysis.urgentAlerts > 0
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
