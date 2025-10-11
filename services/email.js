const nodemailer = require('nodemailer');

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send email function
const sendEmail = async (to, subject, text) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });
    
    console.log('Email sent: ' + info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

// Send OTP email
const sendOTPEmail = async (to, otp) => {
  const subject = 'Your OTP for EazyBac';
  const text = `Your OTP for EazyBac is ${otp}. It is valid for 5 minutes.`;
  
  return await sendEmail(to, subject, text);
};

module.exports = {
  sendEmail,
  sendOTPEmail
};