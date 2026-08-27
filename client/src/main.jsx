import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        gutter={12}
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Outfit, system-ui, sans-serif',
            fontSize: '14px',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.08)',
          },
          success: {
            iconTheme: { primary: '#639922', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#E24B4A', secondary: '#fff' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
