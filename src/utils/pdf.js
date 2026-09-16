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

// Rasterizes a tall container ONCE, then slices the resulting canvas into
// PDF pages at item boundaries instead of at a fixed pixel height — used for
// a stack of independent, same-width blocks (e.g. one printable score sheet
// per match) where naively slicing by page height could cut a block in half
// across two pages. `itemNodes` must be DOM nodes inside `containerNode`, in
// visual top-to-bottom order; each is measured, then packed greedily so a
// page holds as many whole items as fit — the multi-item-per-page packing is
// the whole point (saving paper), not an edge case to avoid.
export async function downloadGroupedNodesAsPdf({ containerNode, itemNodes, filename, marginMm = 12, pageFormat = 'a4' }) {
  const pdf = new jsPDF({ unit: 'pt', format: pageFormat });
  const pageWidthPt = pdf.internal.pageSize.getWidth();
  const pageHeightPt = pdf.internal.pageSize.getHeight();
  const marginPt = marginMm * (72 / 25.4);
  const contentWidthPt = pageWidthPt - 2 * marginPt;
  const contentHeightPt = pageHeightPt - 2 * marginPt;

  const canvas = await toCanvas(containerNode, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true });
  const containerRect = containerNode.getBoundingClientRect();
  const scale = canvas.width / containerRect.width; // matches pixelRatio, derived rather than assumed
  const ptPerCanvasPx = contentWidthPt / canvas.width;
  const maxPageCanvasPx = contentHeightPt / ptPerCanvasPx;

  const items = itemNodes.map((node) => {
    const r = node.getBoundingClientRect();
    return { top: (r.top - containerRect.top) * scale, height: r.height * scale };
  });

  const pages = [];
  let current = [];
  let currentHeight = 0;
  items.forEach((item) => {
    // A lone item taller than a full page still gets its own page (never
    // silently dropped) even though it will overflow that page slightly.
    if (current.length > 0 && currentHeight + item.height > maxPageCanvasPx) {
      pages.push(current);
      current = [];
      currentHeight = 0;
    }
    current.push(item);
    currentHeight += item.height;
  });
  if (current.length > 0) pages.push(current);

  pages.forEach((group, i) => {
    if (i > 0) pdf.addPage();
    const sliceTop = group[0].top;
    const sliceHeight = Math.min(canvas.height - sliceTop, group[group.length - 1].top + group[group.length - 1].height - sliceTop);

    // Same reveal-a-slice-of-the-full-image trick as downloadNodeAsPdf above,
    // just with a variable, content-aware slice height per page instead of a
    // fixed one.
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.max(1, Math.ceil(sliceHeight));
    sliceCanvas.getContext('2d').drawImage(canvas, 0, -sliceTop);

    const imgHeightPt = sliceHeight * ptPerCanvasPx;
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', marginPt, marginPt, contentWidthPt, imgHeightPt);
  });

  pdf.save(filename);
}
