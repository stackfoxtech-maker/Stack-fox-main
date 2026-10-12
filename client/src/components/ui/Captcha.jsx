import { useEffect, useRef } from 'react';
import { setCaptchaToken, resetCaptcha, CAPTCHA_SITE_KEY } from '@lib/captcha';

const SCRIPT = 'https://www.google.com/recaptcha/api.js?render=explicit';

/** reCAPTCHA v2 checkbox. Renders nothing when VITE_RECAPTCHA_SITE_KEY is unset. */
export default function Captcha({ className = 'my-3' }) {
  const box = useRef(null);

  useEffect(() => {
    if (!CAPTCHA_SITE_KEY || !box.current) return undefined;
    let id;
    const mount = () => {
      if (!window.grecaptcha?.render || !box.current || id !== undefined) return;
      id = window.grecaptcha.render(box.current, {
        sitekey: CAPTCHA_SITE_KEY,
        callback: setCaptchaToken,
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      });
      resetCaptcha.fn = () => window.grecaptcha.reset(id);
    };
    window.grecaptcha?.ready ? window.grecaptcha.ready(mount) : loadScript(mount);
    return () => {
      setCaptchaToken('');
      resetCaptcha.fn = null;
    };
  }, []);

  if (!CAPTCHA_SITE_KEY) return null;
  return <div ref={box} className={className} />;
}

function loadScript(onReady) {
  window.__sfCaptchaReady = () => window.grecaptcha.ready(onReady);
  if (document.querySelector(`script[src^="${SCRIPT}"]`)) return;
  const s = document.createElement('script');
  s.src = `${SCRIPT}&onload=__sfCaptchaReady`;
  s.async = true;
  document.head.appendChild(s);
}
