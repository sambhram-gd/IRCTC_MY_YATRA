/**
 * Google Apps Script — IRCTC API CORS Proxy (High-Performance Version)
 *
 * Why this works:
 * Akamai WAF blocks datacenter IPs (like AWS/Vercel/Cloudflare). But Google's consumer IPs
 * (used by Google Apps Script) are NOT blocked by Akamai, because blocking Google's main consumer IPs
 * would block Google search crawlers, Google Translate, and Google bots, which IRCTC cannot do.
 *
 * Setup Instructions:
 * 1. Go to https://script.google.com/
 * 2. Click "New Project".
 * 3. Delete any code in Code.gs and paste this code.
 * 4. Click "Save" (disk icon).
 * 5. Click "Deploy" (blue button) -> "New deployment".
 * 6. Select type: "Web app" (gear icon -> Web app).
 * 7. Set configuration:
 *    - Description: IRCTC Proxy
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone" (CRITICAL: Do NOT select "Anyone with Google account", select "Anyone")
 * 8. Click "Deploy".
 * 9. Authorize permissions if prompted.
 * 10. Copy the "Web app URL" (ends with /exec).
 * 11. Add the environment variable to your Vercel project:
 *     - Key: VITE_PROXY_BASE
 *     - Value: <Your Google Apps Script Web App URL>
 * 12. Redeploy your Vercel project.
 */

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  var targetUrl = e.parameter.url;
  if (!targetUrl) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Missing 'url' parameter" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  // Clean target URL and decode if necessary
  targetUrl = decodeURIComponent(targetUrl);

  // Spoof request headers to look exactly like the official operations portal
  var headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'bmirak': 'webbm',
    'greq': String(new Date().getTime()),
    'origin': 'https://www.operations.irctc.co.in',
    'referer': 'https://www.operations.irctc.co.in/online-charts/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  };

  var options = {
    'method': method,
    'headers': headers,
    'muteHttpExceptions': true,
    'followRedirects': true
  };

  if (method === 'POST' && e.postData && e.postData.contents) {
    options.contentType = 'application/json';
    options.payload = e.postData.contents;
  }

  try {
    var response = UrlFetchApp.fetch(targetUrl, options);
    var content = response.getContentText();
    
    // Google Apps Script automatically handles CORS headers (Access-Control-Allow-Origin: *)
    // when deployed as a Web App accessible by "Anyone".
    return ContentService.createTextOutput(content)
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
