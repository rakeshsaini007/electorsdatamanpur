
export interface Member {
  boothNo: string; // बूथ संख्या
  wardNo: string;  // वार्ड संख्या
  voterSerial: string; // मतदाता क्रमांक
  houseNo: string; // मकान नं०
  svn: string;     // SVN
  voterName: string; // निर्वाचक का नाम
  relativeName: string; // पिता/पति/माता का नाम
  gender: 'म' | 'पु' | 'अन्य'; // लिंग
  age: string; // आयु (from sheet)
  aadhaar: string; // आधार संख्या
  dob: string; // जन्म तिथि
  calculatedAge: string; // उम्र (calculated)
  aadhaarImage?: string; // आधार कार्ड फोटो (base64)
  rowId?: number; // Internal index for updates
}

export type DeleteReason = 'शादी' | 'मृत्यु' | 'डुप्लीकेट' | 'पलायन';

export interface GasResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
