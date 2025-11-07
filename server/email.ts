import { Resend } from 'resend';
import { storage } from './storage';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration from environment variables
// For development: Use Resend's default domain (onboarding@resend.dev)
// For production: Verify your domain in Resend and use your custom domain
const EMAIL_FROM = process.env.EMAIL_FROM || (process.env.NODE_ENV === 'production' ? 'noreply@lockerroom.com' : 'onboarding@resend.dev');
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'LockerRoom';
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';

/**
 * Get logo URL from system branding, with fallback to default LR logo
 * Logo URL is constructed as absolute URL for email compatibility
 */
async function getLogoUrl(): Promise<string> {
  try {
    // Check if storage has getSystemBranding method (PostgresStorage has it, MemStorage might not)
    if ('getSystemBranding' in storage && typeof storage.getSystemBranding === 'function') {
      const branding = await (storage as any).getSystemBranding();
      if (branding?.logoUrl) {
        // If logo is a relative path, make it absolute
        if (branding.logoUrl.startsWith('/')) {
          // For local uploads, construct full URL
          if (branding.logoUrl.startsWith('/uploads/')) {
            return `${FRONTEND_URL}${branding.logoUrl}`;
          }
          return `${FRONTEND_URL}${branding.logoUrl}`;
        }
        // If it's already a full URL (Cloudinary, etc.), use as-is
        if (branding.logoUrl.startsWith('http://') || branding.logoUrl.startsWith('https://')) {
          return branding.logoUrl;
        }
        // Relative path without leading slash
        return `${FRONTEND_URL}/${branding.logoUrl}`;
      }
    }
  } catch (error) {
    console.warn('📧 Failed to fetch branding for logo, using default:', error);
  }
  
  // Default: Return empty string to show text fallback "LR" in email
  // The email template will handle the fallback display
  return '';
}

/**
 * Generate professional email template with logo and improved design
 */
async function getEmailTemplate(options: {
  title: string;
  greeting: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
  footerText?: string;
  otp?: string;
  features?: string[];
}): Promise<string> {
  const logoUrl = await getLogoUrl();
  
  // Professional color scheme - reduced gold, better contrast
  const primaryColor = '#1a1a1a'; // Dark gray/black for primary
  const accentColor = '#FFA500'; // Orange/dark gold (matching system accent)
  const backgroundColor = '#ffffff';
  const textColor = '#333333';
  const lightGray = '#f5f5f5';
  const borderColor = '#e0e0e0';
  const mutedText = '#666666';
  
  const otpBoxStyle = `
    background: ${lightGray};
    border: 2px solid ${borderColor};
    border-radius: 8px;
    padding: 24px;
    display: inline-block;
    margin: 20px 0;
  `;
  
  let buttonHtml = '';
  if (options.buttonText && options.buttonUrl) {
    // Use table-based button for maximum email client compatibility
    // Multiple inline styles and font tags to force black text
    buttonHtml = `
      <div style="text-align: center; margin: 32px 0;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${options.buttonUrl}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="12%" stroke="f" fillcolor="${accentColor}">
          <w:anchorlock/>
          <center style="color:${primaryColor};font-family:sans-serif;font-size:16px;font-weight:600;">${options.buttonText}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;" class="email-button-table" data-darkmode="false">
          <tr>
            <td style="background-color: ${primaryColor} !important; border: 2px solid ${primaryColor} !important; border-radius: 8px !important; padding: 14px 32px; text-align: center;" class="email-button-cell">
              <a href="${options.buttonUrl}" class="email-button-link" style="display: inline-block; text-decoration: none !important; color: ${primaryColor} !important; -webkit-text-fill-color: ${primaryColor} !important; font-weight: 600; font-size: 16px; line-height: 1.2; mso-color-alt: ${primaryColor};" data-darkmode="false">
                <font color="${accentColor}" style="color: ${accentColor} !important; -webkit-text-fill-color: ${primaryColor} !important; text-decoration: none !important;" data-darkmode="false">
                  <span class="email-button-text" style="color: ${accentColor} !important; -webkit-text-fill-color: ${accentColor} !important; text-decoration: none !important;" data-darkmode="false">
                    ${options.buttonText}
                  </span>
                </font>
              </a>
            </td>
          </tr>
        </table>
        <!--<![endif]-->
      </div>
    `;
  }
  
  let otpHtml = '';
  if (options.otp) {
    otpHtml = `
      <div style="text-align: center; margin: 32px 0;">
        <div style="${otpBoxStyle}">
          <div style="font-size: 36px; font-weight: bold; color: ${primaryColor}; letter-spacing: 8px; font-family: 'Courier New', monospace; line-height: 1.2;">
            ${options.otp}
          </div>
        </div>
      </div>
    `;
  }
  
  let featuresHtml = '';
  if (options.features && options.features.length > 0) {
    featuresHtml = `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid ${borderColor};">
        <p style="font-size: 15px; font-weight: 600; color: ${textColor}; margin-bottom: 16px;">
          What you can do:
        </p>
        <ul style="font-size: 14px; color: ${mutedText}; line-height: 1.8; margin: 0; padding-left: 20px;">
          ${options.features.map(feature => `<li style="margin-bottom: 8px;">${feature}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>${options.title}</title>
      <style>
        /* Force black text on orange background for all email clients - base styles */
        .email-button-table td,
        .email-button-cell {
          background-color: ${accentColor} !important;
          border-color: ${primaryColor} !important;
          border-radius: 8px !important;
        }
        .email-button-link,
        .email-button-link font,
        .email-button-text {
          color: ${primaryColor} !important;
          -webkit-text-fill-color: ${primaryColor} !important;
        }
        /* Aggressive dark mode overrides - prevent any color inversion */
        @media (prefers-color-scheme: dark) {
          .email-button-table td,
          .email-button-cell {
            background-color: ${accentColor} !important;
            background: ${accentColor} !important;
            border-color: ${primaryColor} !important;
            border: 2px solid ${primaryColor} !important;
            border-radius: 8px !important;
          }
          .email-button-link,
          .email-button-link *,
          .email-button-link font,
          .email-button-link font *,
          .email-button-text,
          .email-button-text * {
            color: ${primaryColor} !important;
            -webkit-text-fill-color: ${primaryColor} !important;
            text-fill-color: ${primaryColor} !important;
          }
          a[class="email-button-link"],
          a[class="email-button-link"] font,
          a[class="email-button-link"] span {
            color: ${primaryColor} !important;
            -webkit-text-fill-color: ${primaryColor} !important;
          }
        }
        /* Additional selectors for maximum coverage */
        table.email-button-table a,
        table.email-button-table a font,
        table.email-button-table a span,
        td.email-button-cell a,
        td.email-button-cell a font,
        td.email-button-cell a span {
          color: ${primaryColor} !important;
          -webkit-text-fill-color: ${primaryColor} !important;
        }
        @media (prefers-color-scheme: dark) {
          table.email-button-table a,
          table.email-button-table a font,
          table.email-button-table a span,
          td.email-button-cell a,
          td.email-button-cell a font,
          td.email-button-cell a span {
            color: ${primaryColor} !important;
            -webkit-text-fill-color: ${primaryColor} !important;
            background-color: transparent !important;
          }
          table.email-button-table td {
            background-color: ${accentColor} !important;
            background: ${accentColor} !important;
            border-radius: 8px !important;
          }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa; line-height: 1.6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; padding: 20px;">
        <tr>
          <td align="center">
            <table role="presentation" style="max-width: 600px; width: 100%; background-color: ${backgroundColor}; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header with Logo -->
              <tr>
                <td style="background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); padding: 40px 30px; text-align: center; border-bottom: 1px solid ${borderColor};">
                  ${logoUrl ? `
                    <img src="${logoUrl}" alt="LockerRoom" style="max-width: 180px; height: auto; margin: 0 auto; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='table';">
                  ` : ''}
                  <table role="presentation" style="${logoUrl ? 'display: none;' : 'display: table;'} margin: 0 auto; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 0 8px; vertical-align: middle;">
                        <div style="width: 48px; height: 48px; background: ${primaryColor}; border: 2px solid #ffffff; border-radius: 8px; display: table-cell; vertical-align: middle; text-align: center; box-shadow: 0 0 0 1px rgba(0,0,0,0.1);">
                          <span style="font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: 1px; line-height: 44px;">LR</span>
                        </div>
                      </td>
                      <td style="padding: 0 8px; vertical-align: middle;">
                        <span style="font-size: 24px; font-weight: 600; color: ${primaryColor}; line-height: 48px;">LockerRoom</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h1 style="color: ${textColor}; font-size: 24px; font-weight: 600; margin: 0 0 8px 0; line-height: 1.3;">
                    ${options.greeting}
                  </h1>
                  <div style="color: ${mutedText}; font-size: 15px; line-height: 1.7; margin-top: 24px;">
                    ${options.content}
                  </div>
                  ${otpHtml}
                  ${buttonHtml}
                  ${featuresHtml}
                  ${options.footerText ? `
                    <p style="font-size: 13px; color: #999999; margin-top: 32px; padding-top: 24px; border-top: 1px solid ${borderColor};">
                      ${options.footerText}
                    </p>
                  ` : ''}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: ${lightGray}; padding: 24px 30px; text-align: center; border-top: 1px solid ${borderColor};">
                  <p style="font-size: 12px; color: ${mutedText}; margin: 0;">
                    © ${new Date().getFullYear()} LockerRoom. All rights reserved.
                  </p>
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

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;
    const html = await getEmailTemplate({
      title: 'Verify Your Account',
      greeting: `Welcome, ${name}!`,
      content: `
        <p>Thank you for signing up for LockerRoom. Please verify your email address to complete your registration.</p>
        <p>Click the button below to verify your email address:</p>
      `,
      buttonText: 'Verify Email Address',
      buttonUrl: verificationUrl,
      footerText: `If the button doesn't work, copy and paste this link into your browser: ${verificationUrl}<br><br>This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.`
    });
    
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: 'Verify your LockerRoom account',
      html,
      text: `
Welcome to LockerRoom, ${name}!

Thank you for signing up. Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.
      `.trim(),
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 Verification email sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('📧 Error sending verification email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send OTP email
 */
export async function sendOTPEmail(
  email: string,
  otp: string,
  name: string,
  purpose: 'login' | 'registration' = 'login'
): Promise<{ success: boolean; error?: string }> {
  try {
    const subject = purpose === 'registration' 
      ? 'Welcome to LockerRoom - Your One-Time Password' 
      : 'Your LockerRoom One-Time Password';
    
    const html = await getEmailTemplate({
      title: 'Your One-Time Password',
      greeting: `Hello ${name}!`,
      content: `
        <p>Your one-time password (OTP) for LockerRoom is:</p>
      `,
      otp,
      footerText: `This OTP will expire in 30 minutes. Use it to log in to your account.<br><br>If you didn't request this OTP, please ignore this email or contact support if you have concerns.`
    });
    
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject,
      html,
      text: `
Hello ${name}!

Your one-time password (OTP) for LockerRoom is: ${otp}

This OTP will expire in 30 minutes. Use it to log in to your account.

If you didn't request this OTP, please ignore this email.
      `.trim(),
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 OTP email sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('📧 Error sending OTP email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resetUrl = `${FRONTEND_URL}/reset-password-token?token=${token}`;
    
    const html = await getEmailTemplate({
      title: 'Reset Your Password',
      greeting: `Hello ${name},`,
      content: `
        <p>We received a request to reset your password for your LockerRoom account.</p>
        <p>Click the button below to reset your password:</p>
      `,
      buttonText: 'Reset Password',
      buttonUrl: resetUrl,
      footerText: `If the button doesn't work, copy and paste this link into your browser: ${resetUrl}<br><br>This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.`
    });
    
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: 'Reset your LockerRoom password',
      html,
      text: `
Hello ${name},

We received a request to reset your password for your LockerRoom account.

Click the link below to reset your password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.
      `.trim(),
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 Password reset email sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('📧 Error sending password reset email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send welcome email (after email verification)
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const roleDisplayName = role === 'student' ? 'Player' : 
                           role === 'school_admin' ? 'Academy Admin' : 
                           role === 'viewer' ? 'Viewer' : role;
    
    const html = await getEmailTemplate({
      title: 'Welcome to LockerRoom!',
      greeting: `Hello ${name}!`,
      content: `
        <p>Your email has been verified successfully. You're all set to start using LockerRoom as a <strong>${roleDisplayName}</strong>.</p>
        <p>Thank you for joining LockerRoom. We're excited to have you on board!</p>
      `,
      buttonText: 'Log In to LockerRoom',
      buttonUrl: `${FRONTEND_URL}/login`
    });
    
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: 'Welcome to LockerRoom!',
      html,
      text: `
Welcome to LockerRoom, ${name}!

Your email has been verified successfully. You're all set to start using LockerRoom as a ${roleDisplayName}.

Log in here: ${FRONTEND_URL}/login

Thank you for joining LockerRoom!
      `.trim(),
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 Welcome email sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('📧 Error sending welcome email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send student account creation email (when created by admin)
 */
export async function sendStudentAccountEmail(
  email: string,
  name: string,
  otp: string,
  academyName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await getEmailTemplate({
      title: 'Your LockerRoom Account',
      greeting: `Welcome, ${name}!`,
      content: `
        <p>An account has been created for you at <strong>${academyName}</strong> on LockerRoom.</p>
        <p>Your one-time password (OTP) to log in for the first time is:</p>
      `,
      otp,
      buttonText: 'Log In to LockerRoom',
      buttonUrl: `${FRONTEND_URL}/login`,
      footerText: `Use this OTP to log in to your account. After logging in, you'll be asked to set a permanent password.<br><br>This OTP will expire in 30 minutes. If you didn't expect this email, please contact your academy administrator.`
    });
    
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: `Welcome to LockerRoom - ${academyName}`,
      html,
      text: `
Welcome to LockerRoom, ${name}!

An account has been created for you at ${academyName} on LockerRoom.

Your one-time password (OTP) to log in for the first time is: ${otp}

Use this OTP to log in to your account. After logging in, you'll be asked to set a permanent password.

This OTP will expire in 30 minutes.
      `.trim(),
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 Student account email sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('📧 Error sending student account email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send school admin account creation email (when created by system admin)
 */
export async function sendSchoolAdminAccountEmail(
  email: string,
  name: string,
  otp: string,
  academyName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await getEmailTemplate({
      title: 'Your LockerRoom Academy Admin Account',
      greeting: `Welcome, ${name}!`,
      content: `
        <p>An Academy Admin account has been created for you at <strong>${academyName}</strong> on LockerRoom.</p>
        <p>Your one-time password (OTP) to log in for the first time is:</p>
      `,
      otp,
      buttonText: 'Log In to LockerRoom',
      buttonUrl: `${FRONTEND_URL}/login`,
      features: [
        'Manage Players (Students) in your academy',
        'View and manage player content and posts',
        'Create announcements for your academy',
        'Access academy analytics and reports'
      ],
      footerText: `Use this OTP to log in to your account. After logging in, you'll be asked to set a permanent password.<br><br>This OTP will expire in 30 minutes. If you didn't expect this email, please contact the system administrator.`
    });
    
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: `Welcome to LockerRoom - Academy Admin Account`,
      html,
      text: `
Welcome to LockerRoom, ${name}!

An Academy Admin account has been created for you at ${academyName} on LockerRoom.

Your one-time password (OTP) to log in for the first time is: ${otp}

Use this OTP to log in to your account at ${FRONTEND_URL}/login. After logging in, you'll be asked to set a permanent password.

This OTP will expire in 30 minutes.

What you can do as an Academy Admin:
- Manage Players (Students) in your academy
- View and manage player content and posts
- Create announcements for your academy
- Access academy analytics and reports

If you didn't expect this email, please contact the system administrator.
      `.trim(),
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 School admin account email sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('📧 Error sending school admin account email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send scout admin account creation email (when created by system admin)
 */
export async function sendScoutAdminAccountEmail(
  email: string,
  name: string,
  otp: string,
  xenId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await getEmailTemplate({
      title: 'Your LockerRoom Scout Admin Account',
      greeting: `Welcome, ${name}!`,
      content: `
        <p>A Scout Admin account has been created for you on LockerRoom.${xenId ? ` Your XEN ID is: <strong>${xenId}</strong>` : ''}</p>
        <p>Your one-time password (OTP) to log in for the first time is:</p>
      `,
      otp,
      buttonText: 'Log In to LockerRoom',
      buttonUrl: `${FRONTEND_URL}/login`,
      features: [
        'Create and manage XEN Scouts',
        'Review player evaluation forms',
        'Submit evaluation feedback',
        'Manage scout profiles and assignments'
      ],
      footerText: `Use this OTP to log in to your account. After logging in, you'll be asked to set a permanent password.<br><br>This OTP will expire in 30 minutes. If you didn't expect this email, please contact the system administrator.`
    });
    
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: `Welcome to LockerRoom - Scout Admin Account`,
      html,
      text: `
Welcome to LockerRoom, ${name}!

A Scout Admin account has been created for you on LockerRoom.${xenId ? ` Your XEN ID is: ${xenId}` : ''}

Your one-time password (OTP) to log in for the first time is: ${otp}

Use this OTP to log in to your account at ${FRONTEND_URL}/login. After logging in, you'll be asked to set a permanent password.

This OTP will expire in 30 minutes.

What you can do as a Scout Admin:
- Create and manage XEN Scouts
- Review player evaluation forms
- Submit evaluation feedback
- Manage scout profiles and assignments

If you didn't expect this email, please contact the system administrator.
      `.trim(),
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 Scout admin account email sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('📧 Error sending scout admin account email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send XEN scout account creation email (when created by scout admin)
 */
export async function sendXenScoutAccountEmail(
  email: string,
  name: string,
  otp: string,
  xenId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await getEmailTemplate({
      title: 'Your LockerRoom XEN Scout Account',
      greeting: `Welcome, ${name}!`,
      content: `
        <p>A XEN Scout account has been created for you on LockerRoom. Your XEN ID is: <strong>${xenId}</strong></p>
        <p>Your one-time password (OTP) to log in for the first time is:</p>
      `,
      otp,
      buttonText: 'Log In to LockerRoom',
      buttonUrl: `${FRONTEND_URL}/login`,
      features: [
        'Review player evaluation forms',
        'Submit evaluation feedback and ratings',
        'Access player profiles and statistics',
        'Participate in player evaluation processes'
      ],
      footerText: `Use this OTP to log in to your account. After logging in, you'll be asked to set a permanent password.<br><br>This OTP will expire in 30 minutes. If you didn't expect this email, please contact your scout admin.`
    });
    
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: `Welcome to LockerRoom - XEN Scout Account`,
      html,
      text: `
Welcome to LockerRoom, ${name}!

A XEN Scout account has been created for you on LockerRoom. Your XEN ID is: ${xenId}

Your one-time password (OTP) to log in for the first time is: ${otp}

Use this OTP to log in to your account at ${FRONTEND_URL}/login. After logging in, you'll be asked to set a permanent password.

This OTP will expire in 30 minutes.

What you can do as a XEN Scout:
- Review player evaluation forms
- Submit evaluation feedback and ratings
- Access player profiles and statistics
- Participate in player evaluation processes

If you didn't expect this email, please contact your scout admin.
      `.trim(),
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 XEN scout account email sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('📧 Error sending XEN scout account email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send system admin account creation email (when created by system admin)
 */
export async function sendSystemAdminAccountEmail(
  email: string,
  name: string,
  otp: string
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  try {
    const html = await getEmailTemplate({
      title: 'Your LockerRoom System Admin Account',
      greeting: `Welcome, ${name}!`,
      content: `
        <p>A System Admin account has been created for you on LockerRoom.</p>
        <p>Your one-time password (OTP) to log in for the first time is:</p>
      `,
      otp,
      buttonText: 'Log In to LockerRoom',
      buttonUrl: `${FRONTEND_URL}/login`,
      features: [
        'Manage Academies (Schools) and their subscriptions',
        'Create and manage Academy Admins',
        'Create and manage Scout Admins and XEN Scouts',
        'Access system-wide analytics and reports',
        'Manage system settings and configurations',
        'Create system announcements and banners'
      ],
      footerText: `Use this OTP to log in to your account. After logging in, you'll be asked to set a permanent password.<br><br>This OTP will expire in 30 minutes. If you didn't expect this email, please contact the system administrator immediately.`
    });
    
    console.log(`📧 Attempting to send email via Resend...`);
    console.log(`📧 From: ${EMAIL_FROM_NAME} <${EMAIL_FROM}>`);
    console.log(`📧 To: ${email}`);
    console.log(`📧 Subject: Welcome to LockerRoom - System Admin Account`);
    
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: `Welcome to LockerRoom - System Admin Account`,
      html,
      text: `
Welcome to LockerRoom, ${name}!

A System Admin account has been created for you on LockerRoom.

Your one-time password (OTP) to log in for the first time is: ${otp}

Use this OTP to log in to your account at ${FRONTEND_URL}/login. After logging in, you'll be asked to set a permanent password.

This OTP will expire in 30 minutes.

What you can do as a System Admin:
- Manage Academies (Schools) and their subscriptions
- Create and manage Academy Admins
- Create and manage Scout Admins and XEN Scouts
- Access system-wide analytics and reports
- Manage system settings and configurations
- Create system announcements and banners

If you didn't expect this email, please contact the system administrator immediately.
      `.trim(),
    });

    console.log(`📧 Resend API Response - Data:`, JSON.stringify(data, null, 2));
    console.log(`📧 Resend API Response - Error:`, error ? JSON.stringify(error, null, 2) : 'No error');

    if (error) {
      console.error('📧 Resend error:', error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    if (!data || !data.id) {
      console.error('📧 Resend returned no data or email ID');
      return { success: false, error: 'Resend API returned no email ID' };
    }

    console.log(`📧 System admin account email sent to ${email}`);
    console.log(`📧 Resend email ID: ${data.id} - Check delivery status in Resend dashboard`);
    return { success: true, emailId: data.id };
  } catch (error: any) {
    console.error('📧 Error sending system admin account email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}


