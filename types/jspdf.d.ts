declare module 'jspdf' {
    export interface jsPDFOptions {
        orientation?: 'portrait' | 'landscape'
        unit?: 'pt' | 'mm' | 'cm' | 'in'
        format?: string | [number, number]
        compress?: boolean
    }

    export class jsPDF {
        constructor(options?: jsPDFOptions)
        
        // Text methods
        text(text: string | string[], x: number, y: number, options?: {
            align?: 'left' | 'center' | 'right' | 'justify'
            maxWidth?: number
            lineHeightFactor?: number
        }): jsPDF
        
        // Font methods
        setFont(fontName: string, fontStyle?: string): jsPDF
        setFontSize(size: number): jsPDF
        setTextColor(r: number, g?: number, b?: number): jsPDF
        
        // Drawing methods
        setFillColor(r: number, g?: number, b?: number): jsPDF
        setDrawColor(r: number, g?: number, b?: number): jsPDF
        setLineWidth(width: number): jsPDF
        rect(x: number, y: number, w: number, h: number, style?: string): jsPDF
        roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string): jsPDF
        line(x1: number, y1: number, x2: number, y2: number): jsPDF
        circle(x: number, y: number, r: number, style?: string): jsPDF
        
        // Page methods
        addPage(format?: string | [number, number], orientation?: 'portrait' | 'landscape'): jsPDF
        getNumberOfPages(): number
        setPage(pageNumber: number): jsPDF
        
        // Document methods
        save(filename: string): jsPDF
        output(type: string): string | Blob | ArrayBuffer
        
        // Internal
        internal: {
            pageSize: {
                getWidth(): number
                getHeight(): number
            }
            getNumberOfPages(): number
        }
        
        getTextWidth(text: string): number
        splitTextToSize(text: string, maxWidth: number): string[]
    }
    
    export default jsPDF
}

