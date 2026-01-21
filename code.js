
/**
 * GOOGLE APPS SCRIPT BACKEND
 * Save this content into a 'Code.gs' file in your Google Apps Script project.
 * Ensure the project has 'Data' and 'Deleted' sheets.
 */

const SHEET_NAME_DATA = "Data";
const SHEET_NAME_DELETED = "Deleted";

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getData") {
    return handleGetData();
  }
  
  return ContentService.createTextOutput("Invalid Action")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    
    if (action === "saveMember") {
      return handleSaveMember(body.data);
    } else if (action === "deleteMember") {
      return handleDeleteMember(body.data);
    }
    
    return createJsonResponse({ success: false, error: "Invalid Action" });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function ensureHeadersExist(sheet) {
  const expectedHeaders = [
    "बूथ संख्या", "वार्ड संख्या", "मतदाता क्रमांक", "मकान नं०", 
    "SVN", "निर्वाचक का नाम", "पिता/पति/माता का नाम", "लिंग", 
    "आयु", "आधार संख्या", "जन्म तिथि", "उम्र", "आधार फोटो"
  ];
  
  const lastCol = sheet.getLastColumn();
  let currentHeaders = [];
  if (lastCol > 0) {
    currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  }
  
  let headersUpdated = false;
  expectedHeaders.forEach(header => {
    if (currentHeaders.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headersUpdated = true;
    }
  });
  
  if (headersUpdated) {
    SpreadsheetApp.flush();
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }
  return currentHeaders;
}

function handleGetData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_DATA);
  
  if (!sheet) {
    return createJsonResponse({ success: false, error: "Sheet 'Data' not found" });
  }
  
  const headers = ensureHeadersExist(sheet);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return createJsonResponse({ success: true, data: [] });
  
  const data = values.slice(1).map((row, index) => {
    let obj = { rowId: index + 2 }; 
    headers.forEach((header, idx) => {
      const keyMap = {
        "बूथ संख्या": "boothNo",
        "वार्ड संख्या": "wardNo",
        "मतदाता क्रमांक": "voterSerial",
        "मकान नं०": "houseNo",
        "SVN": "svn",
        "निर्वाचक का नाम": "voterName",
        "पिता/पति/माता का नाम": "relativeName",
        "लिंग": "gender",
        "आयु": "age",
        "आधार संख्या": "aadhaar",
        "जन्म तिथि": "dob",
        "उम्र": "calculatedAge",
        "आधार फोटो": "aadhaarImage"
      };
      const key = keyMap[header] || header;
      let val = row[idx];
      
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0];
      }
      
      obj[key] = val !== undefined ? val.toString() : "";
    });
    return obj;
  });
  
  return createJsonResponse({ success: true, data: data });
}

function handleSaveMember(memberData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_DATA);
  
  const headers = ensureHeadersExist(sheet);
  const values = sheet.getDataRange().getValues();
  let rowIndex = -1;
  const svnColIndex = headers.indexOf("SVN");
  
  if (svnColIndex === -1) return createJsonResponse({ success: false, error: "Critical Header 'SVN' missing" });

  for (let i = 1; i < values.length; i++) {
    if (values[i][svnColIndex].toString() === memberData.svn.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  
  const keyMapInverse = {
    "boothNo": "बूथ संख्या",
    "wardNo": "वार्ड संख्या",
    "voterSerial": "मतदाता क्रमांक",
    "houseNo": "मकान नं०",
    "svn": "SVN",
    "voterName": "निर्वाचक का नाम",
    "relativeName": "पिता/पति/माता का नाम",
    "gender": "लिंग",
    "age": "आयु",
    "aadhaar": "आधार संख्या",
    "dob": "जन्म तिथि",
    "calculatedAge": "उम्र",
    "aadhaarImage": "आधार फोटो"
  };

  const rowData = headers.map(header => {
    for (let key in keyMapInverse) {
      if (keyMapInverse[key] === header) {
        return memberData[key] || "";
      }
    }
    return "";
  });

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  
  return createJsonResponse({ success: true });
}

function handleDeleteMember(memberData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SHEET_NAME_DATA);
  const deletedSheet = ss.getSheetByName(SHEET_NAME_DELETED);
  
  if (!deletedSheet) {
    ss.insertSheet(SHEET_NAME_DELETED);
    const headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
    headers.push("हटाने का कारण");
    ss.getSheetByName(SHEET_NAME_DELETED).appendRow(headers);
  }
  
  const values = dataSheet.getDataRange().getValues();
  const headers = values[0];
  const svnColIndex = headers.indexOf("SVN");
  
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][svnColIndex].toString() === memberData.svn.toString()) {
      rowIndex = i + 1;
      const rowToMove = values[i];
      rowToMove.push(memberData.reason || "");
      ss.getSheetByName(SHEET_NAME_DELETED).appendRow(rowToMove);
      dataSheet.deleteRow(rowIndex);
      return createJsonResponse({ success: true });
    }
  }
  
  return createJsonResponse({ success: false, error: "Member not found" });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
