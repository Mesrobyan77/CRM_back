require("dotenv").config();
function resetPasswordTemp(username, code) { 
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Email Verification</title>
    </head>
    <body style="margin:0; padding:0; background:#f9fafb; font-family:Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1); padding:40px;">
              <tr>
                <td align="center" style="font-size:28px; font-weight:bold; color:#111827; padding-bottom:20px;">
                  Hello, ${username}!
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:16px; color:#4b5563; padding-bottom:30px;">
                  Click the button below to verify your email address:
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="display:inline-block; padding:16px 32px; font-size:18px; font-weight:bold; color:#ffffff; background:#3b82f6; border-radius:8px; text-decoration:none;">
                    ${code}
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:14px; color:#6b7280; padding-top:30px;">
                  If you didn’t request this, you can safely ignore this email.
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:40px; font-size:12px; color:#9ca3af;">
                  &copy; ${new Date().getFullYear()} Your App. All rights reserved.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
}

module.exports = { resetPasswordTemp };
