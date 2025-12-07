import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PurchaseOrder, Project } from '../types';

export const generatePurchaseOrderPDF = (order: PurchaseOrder, project: Project) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // --- HEADER ---
    // Logo (Placeholder or Text if image fails)
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Emerald 500
    doc.text("BEL AIR HABITAT", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("19 B Rue de la Tourelle", 14, 26);
    doc.text("95170 DEUIL-LA-BARRE", 14, 31);
    doc.text("SIREN : 930 674 932", 14, 36);

    // Document Title
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text("BON DE COMMANDE", pageWidth - 14, 20, { align: 'right' });
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`N° ${order.number}`, pageWidth - 14, 28, { align: 'right' });

    // --- INFO BOXES ---
    const startY = 50;

    // Sender
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.roundedRect(14, startY, 85, 35, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("DONNEUR D'ORDRE", 18, startY + 6);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("BEL AIR HABITAT", 18, startY + 14);
    doc.text("Service Achats / Travaux", 18, startY + 19);
    doc.text("19 B Rue de la Tourelle", 18, startY + 24);
    doc.text("95170 DEUIL-LA-BARRE", 18, startY + 29);

    // Recipient
    doc.roundedRect(pageWidth - 99, startY, 85, 35, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("DESTINATAIRE (SOUS-TRAITANT)", pageWidth - 95, startY + 6);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(order.subcontractorName || "Nom du sous-traitant", pageWidth - 95, startY + 14);

    // --- DETAILS BAR ---
    const barY = startY + 45;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(14, barY, pageWidth - 14, barY);
    doc.line(14, barY + 15, pageWidth - 14, barY + 15);

    const colWidth = (pageWidth - 28) / 4;

    const drawDetail = (label: string, value: string, x: number) => {
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(label.toUpperCase(), x + (colWidth / 2), barY + 5, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(value, x + (colWidth / 2), barY + 11, { align: 'center' });
    };

    drawDetail("Date Commande", new Date(order.date).toLocaleDateString(), 14);
    drawDetail("Début Intervention", order.startDate ? new Date(order.startDate).toLocaleDateString() : 'À définir', 14 + colWidth);
    drawDetail("Fin Prévue", order.endDate ? new Date(order.endDate).toLocaleDateString() : 'À définir', 14 + colWidth * 2);
    drawDetail("Référence Chantier", project.businessCode || project.id, 14 + colWidth * 3);

    // --- DESCRIPTION ---
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Objet de la commande :", 14, barY + 25);
    doc.setFontSize(10);
    doc.setTextColor(50);
    const splitDesc = doc.splitTextToSize(order.description || "", pageWidth - 28);
    doc.text(splitDesc, 14, barY + 32);

    // --- TABLE ---
    const tableStartY = barY + 35 + (splitDesc.length * 5);

    const tableBody = order.tasks?.map(task => [task, "1.00", "-"]) || [];
    tableBody.push(["Forfait Global Convenu", "1.00", `${Number(order.amountHT).toLocaleString()} €`]);

    autoTable(doc, {
        startY: tableStartY,
        head: [['Désignation des Prestations', 'Qté', 'Total HT']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'right', cellWidth: 30 },
            2: { halign: 'right', cellWidth: 40 }
        },
        styles: { fontSize: 10, cellPadding: 4 }
    });

    // --- TOTALS ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalBoxX = pageWidth - 80;

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Total HT", totalBoxX, finalY);
    doc.text(`${Number(order.amountHT).toLocaleString()} €`, pageWidth - 14, finalY, { align: 'right' });

    doc.text("TVA (Autoliquidation)", totalBoxX, finalY + 7);
    doc.text("0.00 €", pageWidth - 14, finalY + 7, { align: 'right' });

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Net à Payer", totalBoxX, finalY + 16);
    doc.text(`${Number(order.amountHT).toLocaleString()} €`, pageWidth - 14, finalY + 16, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("TVA non applicable, art. 283-2 du CGI", pageWidth - 14, finalY + 22, { align: 'right' });

    // --- FOOTER / LEGAL ---
    const pageHeight = doc.internal.pageSize.height;

    doc.setFillColor(241, 245, 249);
    doc.rect(14, pageHeight - 50, pageWidth - 28, 15, 'F');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text("CONDITIONS DE RÈGLEMENT : 100% à réception de facture après validation de fin de chantier.", pageWidth / 2, pageHeight - 44, { align: 'center' });
    doc.text("Le sous-traitant déclare être à jour de ses obligations sociales et fiscales.", pageWidth / 2, pageHeight - 40, { align: 'center' });

    // Signatures
    const signY = pageHeight - 25;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Pour BEL AIR HABITAT", 14, signY);
    doc.text("Pour LE SOUS-TRAITANT", pageWidth / 2 + 10, signY);

    doc.text("(Date et Signature)", 14, pageHeight - 10);
    doc.text("(Date, Cachet et Signature)", pageWidth / 2 + 10, pageHeight - 10);

    // Save
    doc.save(`BDC_${order.number}_${order.subcontractorName.replace(/\s+/g, '_')}.pdf`);
};
