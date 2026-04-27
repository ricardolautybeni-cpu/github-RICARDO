const express = require('express');
const fs = require('fs');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const { generatePaymentReceipt, isValidSignature } = require('../services/paymentReceipt');

const router = express.Router();

/**
 * POST /api/receipts/generate-payment
 * Generar recibo de pago con firma
 */
router.post('/generate-payment', authMiddleware, async (req, res) => {
  const { payment_id, signature_base64 } = req.body;

  if (!payment_id) {
    return res.status(400).json({ error: 'payment_id requerido' });
  }

  try {
    // Obtener datos del pago
    const paymentResult = await db.query(
      `SELECT cp.*, c.*, u.full_name
       FROM client_payments cp
       LEFT JOIN clients c ON cp.client_id = c.id
       LEFT JOIN users u ON cp.registered_by = u.id
       WHERE cp.id = $1`,
      [payment_id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    const payment = paymentResult.rows[0];

    // Validar firma si existe
    if (signature_base64 && !isValidSignature(signature_base64)) {
      return res.status(400).json({
        error: 'Firma digital no es válida. Intenta capturarla nuevamente.'
      });
    }

    // Guardar firma en BD si existe
    if (signature_base64) {
      await db.query(
        'UPDATE client_payments SET signature_data = $1 WHERE id = $2',
        [signature_base64, payment_id]
      );
    }

    // Generar recibo PDF
    const receiptData = {
      paymentId: payment.id,
      client: {
        name: payment.name,
        document_type: payment.document_type,
        document_number: payment.document_number,
        address: payment.address,
        email: payment.email,
        phone: payment.phone
      },
      amount: payment.amount,
      previousDebt: parseFloat(payment.previous_debt) || 0,
      newDebt: parseFloat(payment.new_debt) || 0,
      paymentMethod: payment.payment_method,
      reference: payment.reference,
      signature_base64,
      vendorName: payment.full_name,
      distributorName: process.env.DISTRIBUTOR_NAME || 'TU DISTRIBUIDORA',
      timestamp: new Date()
    };

    const receipt = await generatePaymentReceipt(receiptData);

    res.json({
      success: true,
      message: 'Recibo generado con éxito',
      receiptUrl: receipt.url,
      filename: receipt.filename
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/receipts/save-signature
 * Guardar firma sin generar recibo (preview)
 */
router.post('/save-signature', authMiddleware, async (req, res) => {
  const { check_in_id, signature_base64 } = req.body;

  if (!check_in_id || !signature_base64) {
    return res.status(400).json({
      error: 'check_in_id y signature_base64 son requeridos'
    });
  }

  try {
    if (!isValidSignature(signature_base64)) {
      return res.status(400).json({
        error: 'Firma no válida'
      });
    }

    const result = await db.query(
      `UPDATE seller_checkins 
       SET signature_data = $1 
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [signature_base64, check_in_id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Check-in no encontrado' });
    }

    res.json({
      success: true,
      message: 'Firma guardada',
      checkInId: check_in_id,
      hasSignature: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/receipts/:receiptFilename
 * Descargar recibo PDF
 */
router.get('/:receiptFilename', (req, res) => {
  try {
    const path = require('path');
    const filename = req.params.receiptFilename;
    const filepath = path.join(__dirname, '../../pdfs', filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Recibo no encontrado' });
    }

    res.download(filepath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
