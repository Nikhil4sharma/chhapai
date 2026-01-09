// Proforma Invoice PDF Generator
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ProductLine {
    description: string;
    quantity: number;
    rate: number;
}

export interface ProformaInvoiceData {
    piNumber: string;
    date: string;
    issuePerson: string;
    purchaserName: string;
    purchaserAddress: string;
    purchaserGst?: string;
    products: ProductLine[];
    shippingCharges: number;
    includeGst: boolean;
}

export const generateProformaInvoice = (data: ProformaInvoiceData): void => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let yPos = 15;

    // Company Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('GENIE PRINTS PVT. LTD.', 15, yPos);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text('Plot No.163, Industrial Area,', 15, yPos);
    yPos += 4;
    doc.text('Phase-1, Chandigarh', 15, yPos);
    yPos += 4;
    doc.text('GST: 04AACCG9646F1ZM', 15, yPos);
    yPos += 4;
    doc.text('PAN NO : AACCG9646F', 15, yPos);
    yPos += 4;
    doc.text('State Name : Chandigarh | Code:04', 15, yPos);
    yPos += 4;
    doc.text('E-Mail : accounts@chhapai.in', 15, yPos);
    yPos += 4;
    doc.text('Contact No. : +91 9878 155 155', 15, yPos);

    // Logo - Load from public folder
    const logoImg = new Image();
    logoImg.src = '/logo.png';
    doc.addImage(logoImg, 'PNG', pageWidth - 45, 15, 30, 30);

    // Title
    yPos += 8;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const title = 'PROFORMA INVOICE';
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);

    yPos += 8;

    // Invoice Details Table
    const detailsStartY = yPos;

    // Purchaser Info (Left)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Purchaser Name & Address:', 15, yPos);

    // PI Details (Right)
    doc.text('PI No:', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.piNumber, pageWidth / 2 + 35, yPos);

    yPos += 5;
    doc.setFont('helvetica', 'normal');

    // Split address into lines
    const addressLines = doc.splitTextToSize(data.purchaserName + '\n' + data.purchaserAddress, pageWidth / 2 - 25);
    doc.text(addressLines, 15, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.date, pageWidth / 2 + 35, yPos);

    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Issue Person :', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.issuePerson, pageWidth / 2 + 35, yPos);

    if (data.purchaserGst) {
        yPos += Math.max(addressLines.length * 4, 10);
        doc.setFont('helvetica', 'normal');
        doc.text('GST ' + data.purchaserGst, 15, yPos);
    }

    yPos += 10;

    // Supplier Info
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Supplier:', 15, yPos);
    doc.text('Bill To:', pageWidth / 2 + 10, yPos);

    // Track separate Y positions for left and right columns
    let leftYPos = yPos + 5;
    let rightYPos = yPos + 5;

    // Left column (Supplier)
    doc.setFont('helvetica', 'normal');
    doc.text('Genie Prints Pvt. Ltd.', 15, leftYPos);
    leftYPos += 4;
    doc.text('Plot No.163, Industrial Area, Phase-1', 15, leftYPos);
    leftYPos += 4;
    doc.text('GSTIN: 04AACCG9646F1ZM', 15, leftYPos);
    leftYPos += 4;
    doc.text('State Name: Chandigarh | Code:04', 15, leftYPos);
    leftYPos += 4;
    doc.text('E-Mail: accounts@chhapai.in', 15, leftYPos);
    leftYPos += 4;
    doc.text('Bank Name: Bank of Baroda O/D', 15, leftYPos);
    leftYPos += 4;
    doc.text('A/C No.:18140400018771', 15, leftYPos);
    leftYPos += 4;
    doc.text('IFSC Code : BARB0KHURDX', 15, leftYPos);

    // Right column (Bill To)
    doc.text(data.purchaserName.toUpperCase(), pageWidth / 2 + 10, rightYPos);
    rightYPos += 4;

    const billToAddress = doc.splitTextToSize(data.purchaserAddress, pageWidth / 2 - 25);
    doc.text(billToAddress, pageWidth / 2 + 10, rightYPos);
    rightYPos += billToAddress.length * 4;

    if (data.purchaserGst) {
        doc.text('GST ' + data.purchaserGst, pageWidth / 2 + 10, rightYPos);
        rightYPos += 4;
    }

    // Use the maximum of left and right Y positions to continue
    yPos = Math.max(leftYPos, rightYPos) + 4;

    // Product Table
    const tableData = data.products.map((product, index) => [
        (index + 1).toString(),
        product.description,
        product.quantity.toString(),
        product.rate.toFixed(2),
        (product.quantity * product.rate).toFixed(2)
    ]);

    // Calculate totals
    const subtotal = data.products.reduce((sum, p) => sum + (p.quantity * p.rate), 0);
    const taxableAmount = subtotal + data.shippingCharges;
    const gstAmount = data.includeGst ? taxableAmount * 0.18 : 0;
    const totalInvoice = taxableAmount + gstAmount;

    // Add empty rows for spacing
    for (let i = 0; i < Math.max(0, 5 - data.products.length); i++) {
        tableData.push(['', '', '', '', '']);
    }

    // Add summary rows
    tableData.push(['', 'Taxable Amount', '', '', taxableAmount.toFixed(2)]);

    if (data.includeGst) {
        tableData.push(['', 'GST 18%', '', '', gstAmount.toFixed(2)]);
    }

    if (data.shippingCharges > 0) {
        tableData.push(['', 'Shipping Charges', '', '', data.shippingCharges.toFixed(2)]);
    }

    tableData.push(['', '', '', 'Total Invoice', totalInvoice.toFixed(2) + '/-']);

    autoTable(doc, {
        startY: yPos,
        head: [['S.No.', 'Item Description', 'Qty', 'Rate', 'Amount']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 2,
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [0, 0, 0],
        },
        bodyStyles: {
            lineWidth: 0.5,
            lineColor: [0, 0, 0],
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' },
        },
        didParseCell: (data) => {
            // Bold the last row (Total)
            if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
            }
            // Bold summary rows
            if (data.row.index >= tableData.length - (data.includeGst ? 4 : 3)) {
                data.cell.styles.fontStyle = 'bold';
            }
        },
    });

    // Footer Notes
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Please Note:', 15, finalY);

    doc.setFont('helvetica', 'normal');
    doc.text('- 100% advance to be paid.', 20, finalY + 5);
    doc.text('- Shipping will be as per actual.', 20, finalY + 10);

    // Download
    doc.save(`Proforma_Invoice_${data.piNumber}.pdf`);
};

// Generate unique PI number
export const generatePINumber = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    return `${year}${month}${day}${random}`;
};
