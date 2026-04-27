const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../db/connection');

// Directorio de PDFs
const pdfDir = path.join(__dirname, '../../pdfs');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// Generar factura en PDF
async function generateInvoice(saleId) {
  try {
    // Obtener datos de la venta
    const saleResult = await db.query(
      `SELECT s.*, u.full_name as seller_name, c.name as client_name, c.address as client_address 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       LEFT JOIN clients c ON s.client_id = c.id 
       WHERE s.id = $1`,
      [saleId]
    );

    if (saleResult.rows.length === 0) {
      throw new Error('Venta no encontrada');
    }

    const sale = saleResult.rows[0];

    // Obtener items de la venta
    const itemsResult = await db.query(
      `SELECT si.*, p.code, p.name 
       FROM sale_items si 
       LEFT JOIN products p ON si.product_id = p.id 
       WHERE si.sale_id = $1`,
      [saleId]
    );

    // Crear documento PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const filename = `invoice_${saleId}.pdf`;
    const filepath = path.join(pdfDir, filename);

    // Pipe a archivo
    doc.pipe(fs.createWriteStream(filepath));

    // Encabezado
    doc.fontSize(24).font('Helvetica-Bold').text('FACTURA', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('', { align: 'center' });

    // Número de factura
    doc.fontSize(11).font('Helvetica-Bold')
      .text(`Factura #: ${saleId}`, { align: 'left' })
      .text(`Fecha: ${new Date(sale.created_at).toLocaleDateString('es-AR')}`, { align: 'left' });

    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown();

    // Info vendedor
    doc.fontSize(10).font('Helvetica-Bold').text('Vendedor:', { underline: true });
    doc.fontSize(9).font('Helvetica')
      .text(sale.seller_name || 'No asignado')
      .moveDown();

    // Info cliente
    doc.fontSize(10).font('Helvetica-Bold').text('Cliente:', { underline: true });
    doc.fontSize(9).font('Helvetica')
      .text(sale.client_name || 'Consumidor Final')
      .text(sale.client_address || '')
      .moveDown();

    // Tabla de items
    doc.fontSize(10).font('Helvetica-Bold');
    const tableTop = doc.y;
    const colWidths = {
      item: 200,
      qty: 80,
      price: 100,
      total: 100
    };

    // Headers
    doc.text('PRODUCTO', 50, tableTop);
    doc.text('CANTIDAD', 50 + colWidths.item);
    doc.text('PRECIO', 50 + colWidths.item + colWidths.qty);
    doc.text('TOTAL', 50 + colWidths.item + colWidths.qty + colWidths.price);

    doc.fontSize(9).font('Helvetica');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown();

    let totalAmount = 0;

    // Items
    itemsResult.rows.forEach((item) => {
      const itemTotal = parseFloat(item.subtotal || 0);
      totalAmount += itemTotal;

      doc.text(item.name, 50, doc.y, { width: colWidths.item })
        .text(item.quantity, 50 + colWidths.item)
        .text(`$${parseFloat(item.unit_price).toFixed(2)}`, 50 + colWidths.item + colWidths.qty)
        .text(`$${itemTotal.toFixed(2)}`, 50 + colWidths.item + colWidths.qty + colWidths.price);

      if (item.bonus > 0) {
        doc.fontSize(8).text(`  + ${item.bonus} bonificación`);
      }
    });

    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown();

    // Totales
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`TOTAL: $${totalAmount.toFixed(2)}`, { align: 'right' });

    doc.fontSize(10).font('Helvetica');
    doc.text(`Método de pago: ${sale.payment_method}`, { align: 'right' })
      .text(`Estado: ${sale.status}`, { align: 'right' });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();

    // Pie de página
    doc.fontSize(8).font('Helvetica').fillColor('#666');
    doc.text('Gracias por su compra', { align: 'center' });
    doc.text(new Date().toLocaleString('es-AR'), { align: 'center' });

    // Finalizar PDF
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve({
          filename,
          filepath,
          url: `/api/invoices/${filename}`
        });
      });

      doc.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    throw new Error(`Error generando factura: ${error.message}`);
  }
}

// Generar reporte de ventas
async function generateSalesReport(startDate, endDate, format = 'pdf') {
  try {
    const salesResult = await db.query(
      `SELECT s.*, u.full_name as seller_name, c.name as client_name 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       LEFT JOIN clients c ON s.client_id = c.id 
       WHERE s.created_at >= $1 AND s.created_at <= $2 
       ORDER BY s.created_at DESC`,
      [startDate, endDate]
    );

    if (format === 'json') {
      return {
        period: { start: startDate, end: endDate },
        totalSales: salesResult.rows.length,
        totalAmount: salesResult.rows.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
        sales: salesResult.rows
      };
    }

    // Generar PDF
    const doc = new PDFDocument({ margin: 50 });
    const filename = `sales_report_${Date.now()}.pdf`;
    const filepath = path.join(pdfDir, filename);

    doc.pipe(fs.createWriteStream(filepath));

    doc.fontSize(20).font('Helvetica-Bold').text('REPORTE DE VENTAS', { align: 'center' });
    doc.fontSize(11).text(`Período: ${startDate} a ${endDate}`, { align: 'center' });
    doc.moveDown();

    // Resumen
    const totalAmount = salesResult.rows.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
    const totalCost = salesResult.rows.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0);
    const profit = totalAmount - totalCost;

    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Total de Ventas: ${salesResult.rows.length}`);
    doc.text(`Monto Total: $${totalAmount.toFixed(2)}`);
    doc.text(`Costo Total: $${totalCost.toFixed(2)}`);
    doc.text(`Ganancia: $${profit.toFixed(2)}`);

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown();

    // Tabla de ventas
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('VENTA ID', 50);
    doc.text('VENDEDOR', 150);
    doc.text('CLIENTE', 250);
    doc.text('MONTO', 400);
    doc.text('FECHA', 480);

    doc.fontSize(8).font('Helvetica');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();

    salesResult.rows.forEach((sale) => {
      doc.text(sale.id.slice(0, 8), 50)
        .text(sale.seller_name || '-', 150)
        .text(sale.client_name || 'General', 250)
        .text(`$${parseFloat(sale.total_amount).toFixed(2)}`, 400)
        .text(new Date(sale.created_at).toLocaleDateString(), 480);
    });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve({
          filename,
          filepath,
          url: `/api/reports/${filename}`
        });
      });

      doc.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Error generando reporte: ${error.message}`);
  }
}

module.exports = {
  generateInvoice,
  generateSalesReport,
  pdfDir
};
