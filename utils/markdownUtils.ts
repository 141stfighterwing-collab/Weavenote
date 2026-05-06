import { visit } from 'unist-util-visit';

export const rehypeSanitizeJunk = () => (tree: any) => {
    visit(tree, 'element', (node: any) => {
        // Fix <o:p> tags from MS Word
        if (node.tagName === 'o:p') {
            node.tagName = 'span';
        }
        
        // Fix invalid React props
        if (node.properties) {
            if ('vAlign' in node.properties) {
                node.properties.valign = node.properties.vAlign;
                delete node.properties.vAlign;
            }
            if ('valign' in node.properties) {
                // React 18+ sometimes still complains about valign on non-table elements, but we'll just lowercase it for td/tr
            }
            if ('ariaC' in node.properties) {
                delete node.properties.ariaC;
            }
            if ('aria-c' in node.properties) {
                delete node.properties['aria-c'];
            }
        }
    });
};

export const cleanMarkdownText = (text: string) => {
    if (!text) return text;
    return text
        .replace(/<\/?o:p[^>]*>/gi, '')
        .replace(/vAlign=/gi, 'valign=')
        .replace(/aria-c=/gi, 'aria-controls=');
};
