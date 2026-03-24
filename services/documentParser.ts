import * as pdfjsLib from 'pdfjs-dist';

// Use a reliable worker source that matches the library version
const version = '4.10.38';
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

export const parseDocument = async (file: File): Promise<string> => {
  // Max file size: 20MB
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
  
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is 20MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
  }
  
  try {
    if (file.type === 'application/pdf') {
      return await parsePDF(file);
    } 
    else if (
      file.type === 'text/plain' || 
      file.name.toLowerCase().endsWith('.txt') ||
      file.name.toLowerCase().endsWith('.md')
    ) {
      return await parseText(file);
    }
    else {
      throw new Error(`Unsupported file type: ${file.type}. Please use PDF, TXT, or MD.`);
    }
  } catch (error: any) {
    console.error("Document Ingestion Error:", error);
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
    useSystemFonts: true,
    isEvalSupported: false
  });
  
  const pdf = await loadingTask.promise;
  let fullText = "";
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Group items by their vertical position (Y coordinate) to reconstruct lines
    const items: any[] = textContent.items;
    const lines: Record<number, any[]> = {};
    
    items.forEach((item: any) => {
      if (!item.str || item.str.trim() === "") return;
      
      // The transform array contains [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const y = Math.round(item.transform[5]);
      if (!lines[y]) lines[y] = [];
      lines[y].push(item);
    });

    // Sort Y coordinates descending (top of page to bottom)
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
    
    let pageText = "";
    sortedY.forEach(y => {
      // Sort items on the same line by their horizontal position (X coordinate)
      const lineItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
      const lineStr = lineItems.map(item => item.str).join(" ");
      pageText += lineStr + "\n";
    });

    fullText += pageText + "\n";
  }

  const result = fullText.trim();
  if (!result) {
    throw new Error("This PDF appears to be a scan (image-only). Please paste a screenshot of the content instead so the Vision Engine can OCR it.");
  }
  
  return result;
};