// Global helper for neon tag styles
export const getTagStyle = (tag: string, isActive: boolean = false) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);

    // Selection state: High-contrast solid neon with black text
    if (isActive) {
        return {
            backgroundColor: `hsl(${hue}, 100%, 65%)`,
            color: '#000',
            borderColor: `hsl(${hue}, 100%, 80%)`,
            boxShadow: `0 0 20px hsla(${hue}, 100%, 65%, 0.7), inset 0 0 8px rgba(255,255,255,0.6)`,
            fontWeight: '900',
            borderWidth: '2px'
        };
    }

    // Standard state: Glowing neon text and border
    return {
        backgroundColor: `hsla(${hue}, 100%, 50%, 0.12)`,
        color: `hsl(${hue}, 100%, 75%)`,
        borderColor: `hsla(${hue}, 100%, 70%, 0.6)`,
        boxShadow: `0 0 12px hsla(${hue}, 100%, 50%, 0.25)`,
        textShadow: `0 0 8px hsla(${hue}, 100%, 75%, 0.5)`,
        borderWidth: '1.5px'
    };
};
