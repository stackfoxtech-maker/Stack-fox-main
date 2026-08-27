import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Button } from '@components/ui/Primitives';
import useAuthStore from '@store/authStore';

export default function VerifyEmail() {
  usePageTitle('Verify Email');
  const [params] = useSearchParams();
  const token = params.get('token');
  const { verifyEmail } = useAuthStore();
  const [status, setStatus] = useState('verifying'); // verifying | success | error

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    verifyEmail(token).then((r) => setStatus(r.success ? 'success' : 'error'));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4">
      <div className="card-fx p-8 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <Loader size={40} className="animate-spin text-fox-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-warm-900">Verifying your email...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="text-success-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-warm-900 mb-2">Email verified!</h2>
            <p className="text-sm text-warm-500 mb-6">Your account is now fully activated.</p>
            <Link to="/app/client"><Button variant="primary">Go to Dashboard</Button></Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} className="text-danger-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-warm-900 mb-2">Verification failed</h2>
            <p className="text-sm text-warm-500 mb-6">This link may be expired or invalid.</p>
            <Link to="/login"><Button variant="outline">Back to Login</Button></Link>
          </>
        )}
      </div>
    </div>
  );
}
