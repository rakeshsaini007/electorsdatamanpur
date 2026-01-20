
import { Member, GasResponse, DeleteReason } from '../types';
import { GAS_WEB_APP_URL } from '../constants';

/**
 * Note: Google Apps Script Web Apps require careful handling of POST requests.
 * We use 'text/plain' or no content-type to keep the request "simple" and avoid CORS preflight (OPTIONS).
 * GAS will still receive the JSON string in e.postData.contents.
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
      mode: 'cors',
      cache: 'no-cache',
      redirect: 'follow',
      body: JSON.stringify({ action: 'saveMember', data: member }),
    });
    
    // Check if the response is actually JSON. GAS redirects can sometimes return HTML on error.
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse GAS response:', text);
      // If we can't parse but the status was OK, it might have succeeded anyway
      if (response.ok) return { success: true };
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error saving member:', error);
    return { success: false, error: 'डाटा सुरक्षित करने में विफल' };
  }
};

export const deleteMember = async (member: Member, reason: DeleteReason): Promise<GasResponse<any>> => {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      redirect: 'follow',
      body: JSON.stringify({ action: 'deleteMember', data: { ...member, reason } }),
    });
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      if (response.ok) return { success: true };
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error deleting member:', error);
    return { success: false, error: 'डाटा हटाने में विफल' };
  }
};
