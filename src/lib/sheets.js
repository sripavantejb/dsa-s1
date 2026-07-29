export const SHEETS = [
  {
    id: 'ccbp',
    label: 'CCBP Sheet',
    description: 'Your original CCBP practice set.',
    source: '',
  },
  {
    id: 'striver',
    label: "Striver's A2Z",
    description: 'Striver’s A2Z DSA sheet — 474 problems from basics to advanced.',
    source: 'https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z',
  },
];

export const SHEET_IDS = SHEETS.map((s) => s.id);
export const DEFAULT_SHEET = 'ccbp';

export function isSheetId(value) {
  return SHEET_IDS.includes(value);
}
