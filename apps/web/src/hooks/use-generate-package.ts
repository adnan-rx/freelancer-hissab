import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { apiClient } from '@/lib/api-client';

export function useGeneratePackage() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePackage = async (elementId: string, taxYear: string) => {
    setIsGenerating(true);
    try {
      // 1. Generate PDF of the dashboard summary
      const element = document.getElementById(elementId);
      if (!element) throw new Error("Could not find dashboard element for PDF generation");
      
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const pdfBlob = pdf.output('blob');

      // 2. Fetch data for CSV ledgers
      const incomeRes = await apiClient.get('/income');
      const incomeList = incomeRes.data?.data || incomeRes.data;
      
      const expenseRes = await apiClient.get('/expenses');
      const expenseList = expenseRes.data?.data || expenseRes.data;

      // 3. Generate CSVs
      const incomeCsv = [
        ['Date', 'Description', 'Platform', 'Currency', 'Original Amount', 'Amount PKR', 'PRC Reference', 'SBP Code'].join(','),
        ...incomeList.map((inc: any) => 
          [
            inc.receivedAt?.substring(0,10), 
            `"${inc.description || ''}"`, 
            inc.platform, 
            inc.currency, 
            inc.amount, 
            inc.amountPKR,
            inc.prcReferenceNumber || '',
            inc.sbpPurposeCode || ''
          ].join(',')
        )
      ].join('\n');

      const expenseCsv = [
        ['Date', 'Description', 'Vendor', 'Category', 'Amount PKR'].join(','),
        ...expenseList.map((exp: any) => 
          [
            exp.expenseDate?.substring(0,10), 
            `"${exp.description || ''}"`, 
            `"${exp.vendor || ''}"`,
            exp.category, 
            exp.amount
          ].join(',')
        )
      ].join('\n');

      // 4. Zip it all together
      const zip = new JSZip();
      zip.file(`FBR-Tax-Summary-${taxYear}.pdf`, pdfBlob);
      zip.file(`Income-Ledger-${taxYear}.csv`, incomeCsv);
      zip.file(`Expense-Ledger-${taxYear}.csv`, expenseCsv);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // 5. Download
      saveAs(zipBlob, `FreelancerHisab-Filing-Package-${taxYear}.zip`);

    } catch (error) {
      console.error("Error generating package:", error);
      alert("Failed to generate package. See console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  return { generatePackage, isGenerating };
}
