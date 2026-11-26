import nodemailer from "nodemailer";

function getSmtpConfig() {
  const user = process.env.USER_EMAIL?.trim();
  const pass = process.env.USER_PASSWORD?.trim();

  if (!user || !pass) {
    throw new Error(
      "Missing USER_EMAIL or USER_PASSWORD environment variable in .env.local."
    );
  }

  return { user, pass };
}

export function createMailTransporter() {
  const { user, pass } = getSmtpConfig();

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendSignupOtpEmail({ to, otp }) {
  const { user } = getSmtpConfig();
  const transporter = createMailTransporter();

  await transporter.sendMail({
    from: `"Chatbot" <${user}>`,
    to,
    subject: `${otp} is your verification code`,
    text: `Your verification code is ${otp}. Enter this 6-digit OTP to verify your email and complete your sign up. This code expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111111;">
        <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700;">Verify your email</h2>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #525252;">
          Use the 6-digit verification code below to complete your sign up. This code expires in 10 minutes.
        </p>
        <div style="background-color: #f7f7f7; border: 1px solid #e5e5e5; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111111;">${otp}</span>
        </div>
        <p style="margin: 0; font-size: 13px; color: #737373;">
          If you didn&rsquo;t request this code, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
