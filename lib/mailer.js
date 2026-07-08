/**
 * lib/mailer.js
 * Nodemailer transporter using Gmail App Password (SMTP).
 * Set GMAIL_USER and GMAIL_APP_PASSWORD in .env
 */
import nodemailer from 'nodemailer';

let _transporter = null;

export function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return _transporter;
}

/**
 * Send an OTP email to a voter or admin.
 * @param {string} to       - recipient email
 * @param {string} otp      - 6-digit OTP
 * @param {string} purpose  - 'vote' | 'org-login' | 'admin-login'
 * @param {string} orgName  - organization name for display
 */
export async function sendOTPEmail(to, otp, purpose = 'vote', orgName = 'Block Vote') {
  const subject = purpose === 'vote'
    ? `Your Voting OTP — ${orgName}`
    : `Your Login OTP — ${orgName}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f172a;font-family:Inter,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">🗳️ Block Vote</h1>
                  <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">Secure Blockchain Voting</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px 36px;">
                  <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
                    ${purpose === 'vote'
                      ? `You requested to cast your vote in <strong style="color:#e2e8f0;">${orgName}</strong>'s election.`
                      : `You requested to log in to <strong style="color:#e2e8f0;">${orgName}</strong>.`
                    }
                    Use the OTP below. It expires in <strong style="color:#e2e8f0;">5 minutes</strong>.
                  </p>
                  <!-- OTP Box -->
                  <div style="background:#0f172a;border:2px solid #6366f1;border-radius:12px;padding:28px;text-align:center;margin:0 0 28px;">
                    <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Your OTP</p>
                    <p style="margin:0;color:#a5b4fc;font-size:48px;font-weight:900;letter-spacing:10px;">${otp}</p>
                  </div>
                  <p style="margin:0;color:#64748b;font-size:13px;">
                    If you didn't request this, ignore this email. Do not share this OTP with anyone.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#0f172a;padding:20px 36px;border-top:1px solid #1e293b;">
                  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
                    Block Vote · Secure Blockchain Voting for Organizations
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;

  await getTransporter().sendMail({
    from: `"Block Vote" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

export async function sendVoteReceiptEmail(
  to,
  {
    orgName = 'Block Vote',
    electionTitle = 'Election',
    candidateName = 'your selected candidate',
    txHash,
    verifyUrl,
  },
) {
  const subject = `Your Vote Receipt — ${orgName}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#0f172a;font-family:Inter,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:linear-gradient(135deg,#10b981,#06b6d4);padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Vote Cast Successfully</h1>
                  <p style="margin:8px 0 0;color:#dcfce7;font-size:14px;">Your blockchain receipt is ready</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 36px;">
                  <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">
                    Your vote in <strong style="color:#ffffff;">${electionTitle}</strong> for
                    <strong style="color:#a5b4fc;">${candidateName}</strong> has been successfully
                    recorded for <strong style="color:#ffffff;">${orgName}</strong>.
                  </p>
                  <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin:0 0 24px;">
                    <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Transaction Hash</p>
                    <p style="margin:0;color:#4ade80;font-size:13px;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;word-break:break-all;">${txHash}</p>
                  </div>
                  <div style="text-align:center;margin:0 0 24px;">
                    <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;">
                      Verify Your Vote
                    </a>
                  </div>
                  <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                    You can use the button above or open this link directly:<br />
                    <a href="${verifyUrl}" style="color:#818cf8;text-decoration:none;word-break:break-all;">${verifyUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#0f172a;padding:20px 36px;border-top:1px solid #1e293b;">
                  <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
                    Block Vote · Public verification without revealing voter identity
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;

  await getTransporter().sendMail({
    from: `"Block Vote" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}
