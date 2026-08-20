/**
 * Configuration for Google Sheets & Google Apps Script API
 * 
 * SPREADSHEET ID: 1s-mnu1hrMW-XompWT0JnJe-Aqcob74Du_-XGgDSG018
 * SHEET NAME: Formulierreacties 1
 */

// ======================================================================================
// 📍 SINGLE CONFIGURATION LOCATION FOR THE GOOGLE APPS SCRIPT WEB APP ENDPOINT URL
// Insert your deployed Google Apps Script Web App URL below:
// Example: "https://script.google.com/macros/s/AKfycbx.../exec"
// ======================================================================================
export const GOOGLE_APPS_SCRIPT_WEBAPP_URL: string = "https://script.google.com/macros/s/AKfycbyOmoczOZvjt9ErITfTyG1dj6cgK-VLkkXu3ork9sEIKNf56maGMD7YriJpA5fFGCUl/exec";

export const GOOGLE_SHEET_CONFIG = {
  spreadsheetId: "1s-mnu1hrMW-XompWT0JnJe-Aqcob74Du_-XGgDSG018",
  worksheetName: "Formulierreacties 1",
  columns: [
    "Tijdstempel",
    "Datum",
    "Tijd",
    "Hoeveelheid (ml)",
    "Pampercontrole",
    "Gewicht (in gram)",
    "Overgegeven?",
    "Opmerkingen?",
    "Voedingstype",
    "Hoeveelheid vaste voeding (g)",
    "Voedingssubtype",
  ] as const,
};

const STORAGE_KEY_CUSTOM_URL = "eli_tracker_gas_endpoint_url";

/**
 * Returns the active API URL (configured constant or user runtime override in settings)
 */
export function getActiveApiUrl(): string {
  if (typeof window !== "undefined") {
    const customUrl = localStorage.getItem(STORAGE_KEY_CUSTOM_URL);
    if (customUrl && customUrl.trim().length > 0) {
      return customUrl.trim();
    }
  }
  return GOOGLE_APPS_SCRIPT_WEBAPP_URL.trim();
}

/**
 * Allows updating the custom API URL from the UI settings
 */
export function setCustomApiUrl(url: string): void {
  if (typeof window !== "undefined") {
    if (!url || url.trim().length === 0) {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_URL);
    } else {
      localStorage.setItem(STORAGE_KEY_CUSTOM_URL, url.trim());
    }
  }
}

/**
 * Google Apps Script (Code.gs) template code to paste into Google Sheet > Extensions > Apps Script
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Eli Tracker - Google Apps Script Backend
 * Attached to Spreadsheet ID: 1s-mnu1hrMW-XompWT0JnJe-Aqcob74Du_-XGgDSG018
 * Sheet: Formulierreacties 1
 */

const SPREADSHEET_ID = "1s-mnu1hrMW-XompWT0JnJe-Aqcob74Du_-XGgDSG018";
const SHEET_NAME = "Formulierreacties 1";

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    // Headers are in row 0
    const headers = data[0];
    const rows = data.slice(1);
    
    const records = rows.map(function(row, index) {
      return {
        rowNumber: index + 2,
        tijdstempel: row[0],
        datum: row[1],
        tijd: row[2],
        hoeveelheidMl: row[3],
        pampercontrole: row[4],
        gewichtGram: row[5],
        overgegeven: row[6],
        opmerkingen: row[7],
        voedingstype: row[8],
        hoeveelheidVasteVoedingG: row[9],
        voedingssubtype: row[10]
      };
    });
    
    const output = JSON.stringify({
      status: "success",
      count: records.length,
      data: records
    });
    
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorOutput = JSON.stringify({
      status: "error",
      message: error.toString()
    });
    return ContentService.createTextOutput(errorOutput)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }
    
    // Format timestamp
    const now = new Date();
    const formattedTimestamp = Utilities.formatDate(now, "Europe/Brussels", "dd/MM/yyyy HH:mm:ss");
    
    // Exactly 11 columns in exact order:
    // 1. Tijdstempel
    // 2. Datum
    // 3. Tijd
    // 4. Hoeveelheid (ml)
    // 5. Pampercontrole
    // 6. Gewicht (in gram)
    // 7. Overgegeven?
    // 8. Opmerkingen?
    // 9. Voedingstype
    // 10. Hoeveelheid vaste voeding (g)
    // 11. Voedingssubtype
    const newRow = [
      formattedTimestamp,
      payload.datum || "",
      payload.tijd || "",
      (payload.ml !== undefined && payload.ml !== null) ? payload.ml : (payload.hoeveelheidMl !== undefined && payload.hoeveelheidMl !== null ? payload.hoeveelheidMl : ""),
      payload.pamper || payload.pampercontrole || "",
      (payload.gewicht !== undefined && payload.gewicht !== null) ? payload.gewicht : (payload.gewichtGram !== undefined && payload.gewichtGram !== null ? payload.gewichtGram : ""),
      payload.overgegeven || "",
      payload.opmerkingen || "",
      payload.voedingstype || "",
      (payload.vasteGram !== undefined && payload.vasteGram !== null) ? payload.vasteGram : (payload.hoeveelheidVasteVoedingG !== undefined && payload.hoeveelheidVasteVoedingG !== null ? payload.hoeveelheidVasteVoedingG : ""),
      payload.voedingssubtype || ""
    ];
    
    sheet.appendRow(newRow);
    
    const output = JSON.stringify({
      status: "success",
      message: "Rij succesvol toegevoegd",
      row: newRow
    });
    
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    const errorOutput = JSON.stringify({
      status: "error",
      message: error.toString()
    });
    return ContentService.createTextOutput(errorOutput)
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
`;
