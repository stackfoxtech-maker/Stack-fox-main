// Module-level on purpose: the <Captcha /> widget writes the token, the axios
// request interceptor in api.js reads it, so no form needs to thread it through.
export const CAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

let token = '';
export const setCaptchaToken = (t) => {
  token = t || '';
};
export const getCaptchaToken = () => token;

// Google tokens are single-use, so the widget is reset after every request.
export const resetCaptcha = { fn: null };
export const consumeCaptcha = () => {
  token = '';
  resetCaptcha.fn?.();
};
