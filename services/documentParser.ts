import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker source using unpkg to ensure strict version matching
const version = pdfjsLib.version || '5.4.449';

// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

export const parseDocument = async (file: File): Promise<string> => {
  try {
    if (file.type === 'application/pdf') {
      return await parsePDF(file);
    } 
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
  const loadingTask = pdfjsLib.getDocument({ 
    data: arrayBuffer,
    disableRange: true,
    disableStream: true
  });
  
  const pdf = await loadingTask.promise;
  
  if (pdf.numPages > 1000) {
    throw new Error(`PDF exceeds the 1000-page limit (Has ${pdf.numPages} pages). Please upload a smaller document.`);
  }

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Improved item sorting and cleaning
    const items = textContent.items
      .map((item: any) => {
        let str = item.str || "";
        
        // Advanced cleaning: remove common PDF garbage like [ ] [][], non-printable chars, and box symbols
        // \u25A1, \u25FB-\u25FE are square box characters
        str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD\u25A1\u25FB-\u25FE]/g, "");
        
        // Remove empty bracket patterns that appear from checkboxes or weird fonts
        str = str.replace(/\[\s*\]/g, "");
        
        return {
          text: str,
          y: item.transform[5],
          x: item.transform[4]
        };
      })
      .filter(item => item.text.trim().length > 0);

    // Group text by vertical coordinate (lines)
    const lines: Record<number, any[]> = {};
    items.forEach(item => {
      const y = Math.round(item.y);
      if (!lines[y]) lines[y] = [];
      lines[y].push(item);
    });

    // Sort lines from top to bottom
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
    let pageText = "";
    sortedY.forEach(y => {
      // Sort items within a line from left to right
      const lineItems = lines[y].sort((a, b) => a.x - b.x);
      const lineStr = lineItems.map(item => item.text).join(" ").trim();
      if (lineStr) pageText += lineStr + "\n";
    });

    fullText += `[Page ${i}]\n${pageText}\n\n`;
  }
  return fullText.trim();
};