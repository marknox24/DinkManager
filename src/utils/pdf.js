import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Rasterizes a DOM node (e.g. an on-screen invoice layout) into a multi-page
// A4 PDF and triggers a download. skipFonts:true avoids a real CORS
// SecurityError html-to-image throws trying to read cssRules from the
// cross-origin Google Fonts stylesheet (same fix as the Randomizer's PNG
// export) — trades the brand font in the PDF for a guaranteed-clean capture.
export async function downloadNodeAsPdf(node, filename) {
  const canvas = await toCanvas(node, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/png');

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  // Standard html2canvas/jsPDF pagination trick: the full image is redrawn
  // on every page, shifted further up (negative y) each time — the page's
  // own bounds clip everything outside its slice, so each addImage call
  // effectively reveals the next page-height chunk of the same tall image.
  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
