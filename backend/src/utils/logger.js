const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const getTimestamp = () => new Date().toISOString();

/**
 * Logs user login activity
 * @param {string} email User email
 * @param {boolean} success Whether login was successful
 * @param {string} ip IP address of the request
 * @param {string} reason Optional reason for failure
 */
const logLogin = (email, success, ip, reason = '') => {
  const logFile = path.join(logDir, 'logins.log');
  const status = success ? 'SUCCESS' : 'FAILED';
  const logEntry = `[${getTimestamp()}] IP: ${ip} | Email: ${email} | Status: ${status} ${reason ? '| Reason: ' + reason : ''}\n`;
  
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error('Failed to write to login log:', err);
  });
};

/**
 * Logs report upload activity
 * @param {string} userId User ID
 * @param {string} reportId Generated unique ID of the report
 * @param {string} status SUCCESS or FAILED
 * @param {number} photoCount Number of photos uploaded
 * @param {string} error Optional error message if failed
 */
const logUpload = (userId, reportId, status, photoCount, error = '') => {
  const logFile = path.join(logDir, 'uploads.log');
  const logEntry = `[${getTimestamp()}] UserID: ${userId} | ReportID: ${reportId || 'N/A'} | Photos: ${photoCount} | Status: ${status} ${error ? '| Error: ' + error : ''}\n`;
  
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error('Failed to write to upload log:', err);
  });
};

module.exports = {
  logLogin,
  logUpload
};
