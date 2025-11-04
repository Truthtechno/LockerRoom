// Utility functions for height conversion and formatting

/**
 * Convert centimeters to feet and inches
 * @param cm - Height in centimeters
 * @returns Object with feet and inches
 */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

/**
 * Convert feet and inches to centimeters
 * @param feet - Height in feet
 * @param inches - Height in inches
 * @returns Height in centimeters
 */
export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return Math.round(totalInches * 2.54);
}

/**
 * Format height in cm to display as feet and inches
 * @param heightCm - Height in centimeters (as string or number)
 * @returns Formatted string like "5'10\"" or empty string if invalid
 */
export function formatHeight(heightCm: string | number | null | undefined): string {
  if (!heightCm) return '';
  
  const cm = typeof heightCm === 'string' ? parseFloat(heightCm) : heightCm;
  if (isNaN(cm) || cm <= 0) return '';
  
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}'${inches}"`;
}

/**
 * Parse height input - supports both cm and ft/in formats
 * @param input - Input string (e.g., "175" for cm, "5'10\"" for ft/in)
 * @param unit - Unit of input ('cm' or 'ft')
 * @returns Height in centimeters as string, or null if invalid
 */
export function parseHeight(input: string, unit: 'cm' | 'ft'): string | null {
  if (!input || !input.trim()) return null;
  
  if (unit === 'cm') {
    const cm = parseFloat(input);
    if (isNaN(cm) || cm <= 0 || cm > 300) return null; // Sanity check
    return cm.toString();
  } else {
    // Parse ft/in format: "5'10" or "5 10" or "510"
    const cleaned = input.trim().replace(/['"]/g, '');
    
    // Try format: "5'10" or "5 10"
    const ftInMatch = cleaned.match(/^(\d+)[\s']*(\d+)$/);
    if (ftInMatch) {
      const feet = parseInt(ftInMatch[1]);
      const inches = parseInt(ftInMatch[2]);
      if (feet >= 0 && feet <= 10 && inches >= 0 && inches < 12) {
        return feetInchesToCm(feet, inches).toString();
      }
    }
    
    // Try format: "510" (5 feet 10 inches)
    if (/^\d{2,3}$/.test(cleaned)) {
      const num = parseInt(cleaned);
      if (num >= 48 && num <= 120) { // 4'0" to 10'0"
        const feet = Math.floor(num / 10);
        const inches = num % 10;
        if (inches < 12) {
          return feetInchesToCm(feet, inches).toString();
        }
      }
    }
    
    return null;
  }
}

