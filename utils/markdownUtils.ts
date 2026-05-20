export const cleanMarkdownText = (text: string) => {
    if (!text) return text;
    return text
        .replace(/<\/?o:p[^>]*>/gi, '')
        .replace(/vAlign=/gi, 'valign=')
        .replace(/aria-c=/gi, 'aria-controls=');
};
