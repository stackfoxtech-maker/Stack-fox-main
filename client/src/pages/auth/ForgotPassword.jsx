import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Input, Button } from '@components/ui/Primitives';
import useAuthStore from '@store/authStore';

export default function ForgotPassword() {
  usePageTitle('Forgot Password');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { forgotPassword, isLoading } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await forgotPassword(email);
    // Only claim the mail is on its way when the server actually accepted it.
    if (result.success) setSent(true);
    else setError(result.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-warm-500 hover:text-warm-700 mb-6">
          <ArrowLeft size={16} /> Back to login
        </Link>

        <h1 className="text-display-sm text-warm-900 mb-2">Reset your password</h1>
        <p className="text-sm text-warm-500 mb-6">Enter your email and we'll send you a reset link.</p>

        {sent ? (
          <div className="card-fx p-6 text-center">
            <div className="w-12 h-12 bg-success-50 text-success-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send size={20} />
            </div>
            <h3 className="font-semibold text-warm-900 mb-2">Check your email</h3>
            <p className="text-sm text-warm-500">If an account exists for {email}, we've sent a password reset link.</p>
          </div>
        ) : (
          <div className="card-fx p-6">
            {error && (
              <div role="alert" className="mb-4 rounded-xl border border-danger-500/20 bg-danger-500/5 px-4 py-3 text-sm text-danger-700">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
              <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">Send Reset Link</Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
