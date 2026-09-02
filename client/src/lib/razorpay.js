// Load the Razorpay Checkout SDK on demand — it used to be a render-blocking
// <script> in index.html on every page (and pulled in cdn./api./lumberjack.
// razorpay.com). Now it only loads when a payment actually starts.

let promise;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => { promise = undefined; reject(new Error('Razorpay SDK failed to load')); };
    document.body.appendChild(s);
  });
  return promise;
}
