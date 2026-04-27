const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../db/connection');

const pdfDir = path.join(__dirname, '../../pdfs');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

/**
 * Generar Recibo con Firma Digital
 * Recibe datos del pago y conversión de firma (base64 a imagen)
 */
async function generatePaymentReceipt(paymentData) {
  try {
    const {
      paymentId,
      client,
      amount,
      previousDebt,
      newDebt,
      paymentMethod,
      reference,
      signature_base64,
      vendorName,
      distributorName,
      timestamp
    } = paymentData;

    // Crear documento
    const doc = new PDFDocument({ margin: 40, size: 'A5' }); // Tamaño pequeño: Recibo
    const filename = `receipt_${paymentId}.pdf`;
    const filepath = path.join(pdfDir, filename);

    doc.pipe(fs.createWriteStream(filepath));

    // Header
    doc.fontSize(14).font('Helvetica-Bold').text(distributorName || 'DISTRIBUIDORA', {
      align: 'center'
    });
    doc.fontSize(10).font('Helvetica').text('RECIBO DE PAGO', { align: 'center' });
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();

    // Número de recibo
    doc.fontSize(9).font('Helvetica-Bold').text(`Recibo #: ${paymentId.slice(0, 8)}`);
    doc.text(`Fecha: ${new Date(timestamp).toLocaleDateString('es-AR')}`);
    doc.text(`Hora: ${new Date(timestamp).toLocaleTimeString('es-AR')}`);
    doc.moveDown();

    // Datos Cliente
    doc.fontSize(9).font('Helvetica-Bold').text('CLIENTE:', { underline: true });
    doc.fontSize(8).font('Helvetica')
      .text(`Nombre: ${client.name}`)
      .text(`Documento: ${client.document_type?.toUpperCase() || 'N/A'} ${client.document_number || ''}`)
      .text(`Dirección: ${client.address || ''}`);
    doc.moveDown();

    // Datos Vendedor
    doc.fontSize(9).font('Helvetica-Bold').text('VENDEDOR:', { underline: true });
    doc.fontSize(8).font('Helvetica').text(vendorName);
    doc.moveDown();

    // Detalles de Pago
    doc.fontSize(9).font('Helvetica-Bold').text('DETALLES DE PAGO:', { underline: true });
    doc.fontSize(8).font('Helvetica');
    doc.text(`Deuda anterior: $${parseFloat(previousDebt).toFixed(2)}`);
    doc.text(`Monto pagado: $${parseFloat(amount).toFixed(2)}`, {
      color: '#228B22' // Verde
    });
    doc.text(`Deuda actual: $${parseFloat(newDebt).toFixed(2)}`);
    doc.moveDown();

    // Método de pago
    doc.fontSize(8).font('Helvetica-Bold').text('Método:', 'left');
    doc.fontSize(8).font('Helvetica').text(paymentMethod.toUpperCase());

    if (reference) {
      doc.fontSize(8).font('Helvetica-Bold').text('Referencia:', 'left');
      doc.fontSize(8).font('Helvetica').text(reference);
    }

    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();

    // Agregar firma digital si existe
    if (signature_base64) {
      try {
        const buffer = Buffer.from(signature_base64.split(',')[1] || signature_base64, 'base64');
        doc.image(buffer, 50, doc.y, { width: 100, height: 60 });
        doc.moveDown(5);
        doc.fontSize(8).font('Helvetica').text('Firma del Cliente', { align: 'center' });
      } catch (signError) {
        doc.fontSize(8).font('Helvetica').text('[Firma Digital no válida]', { align: 'center' });
      }
    } else {
      doc.fontSize(8).font('Helvetica').text('________________________', { align: 'center' });
      doc.fontSize(7).text('Firma del Cliente', { align: 'center' });
    }

    // Pie de página
    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#666');
    doc.text('Este documento es un comprobante de pago', { align: 'center' });
    doc.text('Guarde este recibo como constancia', { align: 'center' });

    // Finalizar
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve({
          filename,
          filepath,
          url: `/pdfs/${filename}`
        });
      });
      doc.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Error generando recibo: ${error.message}`);
  }
}

/**
 * Guardar firma en base64 en BD
 */
async function saveSignature(checkInId, signatureBase64) {
  try {
    const result = await db.query(
      'UPDATE seller_checkins SET signature_data = $1 WHERE id = $2 RETURNING *',
      [signatureBase64, checkInId]
    );

    if (result.rows.length === 0) {
      throw new Error('Check-in no encontrado');
    }

    return result.rows[0];
  } catch (error) {
    throw new Error(`Error guardando firma: ${error.message}`);
  }
}

/**
 * Validar firma (verificar que no sea vacía)
 */
function isValidSignature(signatureBase64) {
  if (!signatureBase64) return false;
  // Mínimo 1KB de datos
  return signatureBase64.length > 1000;
}

module.exports = {
  generatePaymentReceipt,
  saveSignature,
  isValidSignature,
  pdfDir
};
