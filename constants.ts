
import { DeleteReason } from './types';

// Replace this with your actual Google Apps Script Web App URL
export const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby6O5KZzBwsfIf5FMshP56uJIoghmeGCA2phymCTusE-OrOH-aFdvHk21-vrzeTRs2H/exec';

// URL for the source Google Sheet
export const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1vP4G_lJ3yv0N_l6XU9fF2H_M3m-0X-T0G-L0X-T0G-L0/edit';

export const DELETE_REASONS: DeleteReason[] = ['शादी', 'मृत्यु', 'डुप्लीकेट', 'पलायन'];

export const TARGET_DATE = new Date(2026, 0, 1); // January 1, 2026

export const GENDER_OPTIONS = [
  { value: 'म', label: 'महिला' },
  { value: 'पु', label: 'पुरुष' },
  { value: 'अन्य', label: 'अन्य' }
];
