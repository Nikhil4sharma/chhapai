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
    gstRate: number;
}

export const generateProformaInvoice = async (data: ProformaInvoiceData): Promise<void> => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Load logo
    const logoUrl = '/logo.png';
    const logoBase64 = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } else {
                resolve('');
            }
        };
        img.onerror = () => resolve('');
        img.src = logoUrl;
    });

    let yPos = 15;

    // 1. HEADER SECTION
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('GENIE PRINTS PVT. LTD.', 15, yPos);

    doc.setFont('helvetica', 'normal');
    const companyDetails = [
        'Plot No.163, Industrial Area,',
        'Phase-1, Chandigarh',
        'GST: 04AACCG9646F1ZM',
        'PAN NO : AACCG9646F',
        'State Name : Chandigarh | Code:04',
        'E-Mail : accounts@chhapai.in',
        'Contact No. : +91 9878 155 155'
    ];

    yPos += 5;
    companyDetails.forEach(line => {
        doc.text(line, 15, yPos);
        yPos += 5;
    });

    // Right Side: Logo
    if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', pageWidth - 55, 10, 40, 40);
    }

    yPos = Math.max(yPos, 60);

    // 2. TITLE
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const title = 'PROFORMA INVOICE';
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);
    doc.line((pageWidth - titleWidth) / 2, yPos + 1, (pageWidth + titleWidth) / 2, yPos + 1);

    yPos += 5;

    // 3. INFO GRID - Only Company Names and GST Numbers Bold
    const purchaserInfo = `${data.purchaserName}\n\n${data.purchaserAddress}\n\nGST ${data.purchaserGst || 'N/A'}`;

    // Supplier info - only company name and GSTIN bold
    const companyInfoFull = `Genie Prints Pvt. Ltd.
Plot No.163, Industrial Area, Phase-1
GSTIN: 04AACCG9646F1ZM
State Name: Chandigarh | Code:04
E-Mail: accounts@chhapai.in
Bank Name: Bank of Baroda O/D
A/C No.:18140400018771
IFSC Code : BARB0KHURDX`;

    // Bill To info - only company name and GST bold
    const billToInfo = `${data.purchaserName}

${data.purchaserAddress}

GST ${data.purchaserGst || 'N/A'}`;

    autoTable(doc, {
        startY: yPos,
        theme: 'grid',
        body: [
            [
                { content: 'Purchaser Name & Address:', styles: { fontStyle: 'bold' } },
                { content: 'P.I No:', styles: { fontStyle: 'bold' } },
                { content: data.piNumber, styles: { fontStyle: 'normal' } }
            ],
            [
                { content: purchaserInfo, rowSpan: 2, styles: { fontStyle: 'bold' } },
                { content: 'Date:', styles: { fontStyle: 'bold' } },
                { content: data.date, styles: { fontStyle: 'normal' } }
            ],
            [
                { content: 'Issue Person :', styles: { fontStyle: 'bold' } },
                { content: data.issuePerson, styles: { fontStyle: 'normal' } }
            ],
            [
                { content: 'Supplier:', styles: { fontStyle: 'bold' } },
                { content: 'Bill To:', colSpan: 2, styles: { fontStyle: 'bold' } }
            ],
            [
                { content: companyInfoFull, styles: { fontStyle: 'normal' } },
                { content: billToInfo, colSpan: 2, styles: { fontStyle: 'normal' } }
            ]
        ],
        styles: {
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
            textColor: [0, 0, 0],
            fontSize: 9,
            cellPadding: 2,
            overflow: 'linebreak'
        },
        columnStyles: {
            0: { cellWidth: pageWidth * 0.55 },
            1: { cellWidth: 25 },
            2: { cellWidth: 'auto' }
        },
        willDrawCell: (hookData) => {
            // Clear default text drawing for the Supplier/Bill To row (index 4)
            // so we can draw it manually with selective bolding in didDrawCell
            if (hookData.row.index === 4 && (hookData.column.index === 0 || hookData.column.index === 1)) {
                // By emptying cell.text, autoTable won't draw anything here
                // but still draws the border and background
                hookData.cell.text = [];
            }
        },
        didDrawCell: (hookData) => {
            // Draw text manually with selective bolding for Supplier and Bill To
            if (hookData.row.index === 4) {
                const cell = hookData.cell;
                // Get the original content from our body data at this cell
                // Index 132 or 133 in the body array matches row index 4
                const content = hookData.column.index === 0 ? companyInfoFull : billToInfo;
                if (!content) return;

                const lines = content.split('\n');
                let currentY = cell.y + 2.5;

                doc.setFontSize(9);
                lines.forEach((line, idx) => {
                    // First line (company name) and GSTIN line should be bold
                    if (idx === 0 || line.toUpperCase().includes('GST')) {
                        doc.setFont('helvetica', 'bold');
                    } else {
                        doc.setFont('helvetica', 'normal');
                    }
                    // Draw the line manually
                    doc.text(line, cell.x + 2, currentY);
                    currentY += 4;
                });
            }
        }
    });

    // 4. PRODUCTS TABLE WITH INTEGRATED TOTALS
    const finalY = (doc as any).lastAutoTable.finalY - 0.3;

    // Prepare product rows
    const minRows = 5;
    const tableRows = data.products.map((p, i) => [
        (i + 1).toString() + '.',
        p.description,
        p.quantity.toString(),
        p.rate.toFixed(2),
        (p.quantity * p.rate).toFixed(2)
    ]);

    // Add empty rows
    for (let i = tableRows.length; i < minRows; i++) {
        tableRows.push(['', '', '', '', '']);
    }

    // Calculations
    const subtotal = data.products.reduce((sum, p) => sum + (p.quantity * p.rate), 0);
    const taxableAmount = subtotal + data.shippingCharges;
    const gstAmount = taxableAmount * (data.gstRate / 100);
    const totalBeforeRound = taxableAmount + gstAmount;
    const roundedTotal = Math.round(totalBeforeRound);
    const roundOff = roundedTotal - totalBeforeRound;

    const currency = '₹';

    // Add totals rows integrated into the table
    tableRows.push(['', 'Shipping', '', '', data.shippingCharges > 0 ? data.shippingCharges.toFixed(2) : '']);
    tableRows.push(['', 'Taxable Amount', '', '', taxableAmount.toFixed(2)]);

    if (data.gstRate > 0) {
        tableRows.push(['', `GST ${data.gstRate}%`, '', '', gstAmount.toFixed(2)]);
    }

    tableRows.push(['', 'Round Off', '', '', roundOff >= 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)]);
    tableRows.push(['', '', '', 'Total Invoice', `${roundedTotal.toFixed(2)}/-`]);

    autoTable(doc, {
        startY: finalY,
        head: [['S.No.', 'Item Description', 'Qty', 'Rate', 'Amount']],
        body: tableRows,
        theme: 'grid',
        styles: {
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
            textColor: [0, 0, 0],
            fontSize: 10,
            cellPadding: 3,
            valign: 'middle'
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center',
            lineWidth: 0.3,
            lineColor: [0, 0, 0]
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'left' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'left' },
            4: { cellWidth: 35, halign: 'left' }
        },
        didParseCell: (hookData) => {
            const rowIndex = hookData.row.index;
            const totalRowsBeforeTotals = minRows;

            // Bold the totals rows
            if (rowIndex >= totalRowsBeforeTotals) {
                hookData.cell.styles.fontStyle = 'bold';
            }

            // Last row (Total Invoice) - extra bold and different alignment
            if (rowIndex === tableRows.length - 1) {
                if (hookData.column.index === 3 || hookData.column.index === 4) {
                    hookData.cell.styles.halign = 'right';
                }
            }
        }
    });

    // Footer Notes
    const footerY = (doc as any).lastAutoTable.finalY + 10;

    if (footerY < doc.internal.pageSize.getHeight() - 40) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Please Note:', 15, footerY);

        doc.setFont('helvetica', 'normal');
        doc.text('- 100% advance to be paid.', 15, footerY + 5);
        doc.text('- Shipping will be as per actual.', 15, footerY + 10);
    }

    doc.save(`Proforma_Invoice_${data.piNumber}.pdf`);
};

export const generatePINumber = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    return `${year}${month}${day}${random}`;
};
