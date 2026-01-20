
import { Member, GasResponse, DeleteReason } from '../types';
import { GAS_WEB_APP_URL } from '../constants';

/**
 * Note: Since browser fetch to GAS requires the script to be deployed as a web app
 * with 'Anyone, even anonymous' access to work with CORS effectively via redirects.
 */

export const fetchData = async (): Promise<GasResponse<Member[]>> => {
  try {
    const response = await fetch(`${GAS_WEB_APP_URL}?action=getData`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'डाटा लोड करने में विफल' };
  }
};

export const saveMember = async (member: Member): Promise<GasResponse<any>> => {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveMember', data: member }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error saving member:', error);
    return { success: false, error: 'डाटा सुरक्षित करने में विफल' };
  }
};

export const deleteMember = async (member: Member, reason: DeleteReason): Promise<GasResponse<any>> => {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteMember', data: { ...member, reason } }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error deleting member:', error);
    return { success: false, error: 'डाटा हटाने में विफल' };
  }
};
