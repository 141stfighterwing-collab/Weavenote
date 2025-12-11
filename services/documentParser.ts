import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker source using unpkg to ensure strict version matching
// This fixes the "API version does not match Worker version" error.
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const parseDocument = async (file: File): Promise<string> => {
  try {
    // 1. Handle PDF
    if (file.type === 'application/pdf') {
      return await parsePDF(file);
    } 
    // 2. Handle Plain Text / Markdown / JSON / CSV
    else if (
      file.type === 'text/plain' || 
      file.name.toLowerCase().endsWith('.txt') ||
      file.name.toLowerCase().endsWith('.md') ||
      file.name.toLowerCase().endsWith('.json') ||
      file.name.toLowerCase().endsWith('.csv')
    ) {
      return await parseText(file);
    }
    else {
      throw new Error(`Unsupported file type: ${file.type}. Please upload PDF, TXT, or MD.`);
    }
  } catch (error: any) {
    console.error("Document Parsing Error:", error);
    throw new Error(error.message || "Failed to parse document.");
  }
};

const parseText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(new Error("Failed to read text file."));
    reader.readAsText(file);
  });
};

const parsePDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Load the PDF document
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  // Check Page Limit (Increased to 1000 for large study guides)
  if (pdf.numPages > 1000) {
    throw new Error(`PDF exceeds the 1000-page limit (Has ${pdf.numPages} pages). Please upload a smaller document.`);
  }

  let fullText = "";

  // Iterate through pages and extract text
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Extract strings and join them
    const pageText = textContent.items
      // @ts-ignore - 'str' exists on TextItem
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' '); // Normalize excessive whitespace

    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  return fullText;
};
