const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
const text = 'BT /F1 22 Tf 50 760 Td (PDF upload preview) Tj ET\n';
objects.push(`<< /Length ${text.length} >>\nstream\n${text}endstream`);
let pdf = '%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', offsets = [0];
objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
const xref = pdf.length;
pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
pdf += offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
module.exports = Buffer.from(pdf, 'latin1');
