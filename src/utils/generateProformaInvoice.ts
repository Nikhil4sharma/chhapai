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
    gstRate: number; // Changed from includeGst boolean
}

export const generateProformaInvoice = (data: ProformaInvoiceData): void => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let yPos = 15;

    // Use thinner line width for validation
    // Company Header
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('GENIE PRINTS PVT. LTD.', 15, yPos);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text('Plot No.163, Industrial Area,', 15, yPos);
    yPos += 5;
    doc.text('Phase-1, Chandigarh', 15, yPos);
    yPos += 5;
    doc.text('GST: 04AACCG9646F1ZM', 15, yPos);
    yPos += 5;
    doc.text('PAN NO : AACCG9646F', 15, yPos);
    yPos += 5;
    doc.text('State Name : Chandigarh | Code:04', 15, yPos);
    yPos += 5;
    doc.text('E-Mail : accounts@chhapai.in', 15, yPos);
    yPos += 5;
    doc.text('Contact No. : +91 9878 155 155', 15, yPos);

    // Logo - Load from public folder
    const logoImg = new Image();
    logoImg.src = '/logo.png';
    doc.addImage(logoImg, 'PNG', pageWidth - 45, 15, 30, 30);

    // Title
    yPos += 10;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const title = 'PROFORMA INVOICE';
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);

    yPos += 10;


    // Invoice Details Table
    const detailsStartY = yPos;

    // Purchaser Info (Left)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Purchaser Name & Address:', 15, yPos);

    // PI Details (Right)
    doc.text('PI No:', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.piNumber, pageWidth / 2 + 40, yPos);

    yPos += 5;

    // GST Number (Above name as requested)
    if (data.purchaserGst) {
        doc.setFont('helvetica', 'bold');
        doc.text('GST ' + data.purchaserGst, 15, yPos);
    }

    // Date (Right side)
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.date, pageWidth / 2 + 40, yPos);

    yPos += 5;

    // Purchaser Name (Below GST)
    doc.setFont('helvetica', 'bold');
    doc.text(data.purchaserName, 15, yPos);

    // Issue Person (Right side)
    doc.setFont('helvetica', 'bold');
    doc.text('Issue Person :', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.issuePerson, pageWidth / 2 + 40, yPos);

    // Address (Below Name)
    doc.setFont('helvetica', 'normal');
    const addressOnlyLines = doc.splitTextToSize(data.purchaserAddress, pageWidth / 2 - 25);
    doc.text(addressOnlyLines, 15, yPos + 5);

    // Update Y pos based on address length
    const addressHeight = Math.max(addressOnlyLines.length * 5, 5);
    yPos += addressHeight + 15;

    // Supplier Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Supplier:', 15, yPos);
    doc.text('Bill To:', pageWidth / 2 + 10, yPos);

    // Track separate Y positions for left and right columns
    let leftYPos = yPos + 6;
    let rightYPos = yPos + 6;

    // Left column (Supplier)
    // REORDERED: GST First, then Name, then Address
    doc.setFont('helvetica', 'bold'); // Highlight GSTIN
    doc.text('GSTIN: 04AACCG9646F1ZM', 15, leftYPos);
    leftYPos += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Genie Prints Pvt. Ltd.', 15, leftYPos);
    leftYPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.text('Plot No.163, Industrial Area, Phase-1', 15, leftYPos);
    leftYPos += 5;

    doc.text('State Name: Chandigarh | Code:04', 15, leftYPos);
    leftYPos += 5;
    doc.text('E-Mail: accounts@chhapai.in', 15, leftYPos);
    leftYPos += 5;
    doc.text('Bank Name: Bank of Baroda O/D', 15, leftYPos);
    leftYPos += 5;
    doc.text('A/C No.:18140400018771', 15, leftYPos);
    leftYPos += 5;
    doc.text('IFSC Code : BARB0KHURDX', 15, leftYPos);

    // Right column (Bill To)
    if (data.purchaserGst) {
        doc.setFont('helvetica', 'bold');
        doc.text('GST ' + data.purchaserGst, pageWidth / 2 + 10, rightYPos);
        rightYPos += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(data.purchaserName.toUpperCase(), pageWidth / 2 + 10, rightYPos);
    rightYPos += 5;

    doc.setFont('helvetica', 'normal');
    const billToAddress = doc.splitTextToSize(data.purchaserAddress, pageWidth / 2 - 25);
    doc.text(billToAddress, pageWidth / 2 + 10, rightYPos);
    rightYPos += billToAddress.length * 5;

    // Use the maximum of left and right Y positions to continue
    yPos = Math.max(leftYPos, rightYPos) + 5;

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
    const gstAmount = taxableAmount * (data.gstRate / 100);
    const totalInvoice = taxableAmount + gstAmount;

    // Add empty rows for spacing
    for (let i = 0; i < Math.max(0, 5 - data.products.length); i++) {
        tableData.push(['', '', '', '', '']);
    }

    // Add summary rows
    // Using ₹ symbol (UTF-8) - ensure jsPDF handles it or standard font mapping
    const currency = '₹';
    tableData.push(['', 'Taxable Amount', '', '', `${currency} ${taxableAmount.toFixed(2)}`]);

    let numSummaryRows = 2; // Taxable Amount, Total Invoice
    if (data.gstRate > 0) {
        tableData.push(['', `GST ${data.gstRate}%`, '', '', `${currency} ${gstAmount.toFixed(2)}`]);
        numSummaryRows++;
    }

    if (data.shippingCharges > 0) {
        tableData.push(['', 'Shipping Charges', '', '', `${currency} ${data.shippingCharges.toFixed(2)}`]);
        numSummaryRows++;
    }

    tableData.push(['', '', '', 'Total Invoice', `${currency} ${totalInvoice.toFixed(2)}/-`]);

    autoTable(doc, {
        startY: yPos,
        head: [['S.No.', 'Item Description', 'Qty', 'Rate', 'Amount']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 10,
            cellPadding: 4, // Increased padding
            lineWidth: 0.1, // Thin border
            lineColor: [220, 220, 220], // Light gray borders
            textColor: [50, 50, 50]
        },
        headStyles: {
            fillColor: [248, 249, 250], // Very light gray header
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [200, 200, 200],
            halign: 'center'
        },
        bodyStyles: {
            lineWidth: 0.1,
            lineColor: [230, 230, 230],
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'left' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }, // Amount bold?
        },
        didParseCell: (hookData) => {
            // Bold the last row (Total)
            if (hookData.row.index === tableData.length - 1) {
                hookData.cell.styles.fontStyle = 'bold';
                hookData.cell.styles.fillColor = [245, 245, 245]; // Slight highlight for total
            }
            // Bold summary rows
            let summaryRowCount = 2; // Taxable + Total
            if (data.gstRate > 0) summaryRowCount++;
            if (data.shippingCharges > 0) summaryRowCount++;

            if (hookData.row.index >= tableData.length - summaryRowCount) {
                hookData.cell.styles.fontStyle = 'bold';
            }
        },
    });

    // Footer Notes
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
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
