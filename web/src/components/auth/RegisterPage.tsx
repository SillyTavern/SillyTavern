import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Lock, User, AtSign } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button, Input } from '../ui';

export function RegisterPage() {
  const navigate = useNavigate();
  const {
    isLoading,
    error,
    isAuthenticated,
    canSelfRegister,
    register,
    checkRegistration,
    clearError,
  } = useAuthStore();

  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    checkRegistration();
  }, [checkRegistration]);

  const validateForm = (): boolean => {
    setLocalError(null);
    clearError();

    if (!handle.trim()) {
      setLocalError('Username is required');
      return false;
    }

    if (handle.length < 3) {
      setLocalError('Username must be at least 3 characters');
      return false;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(handle)) {
      setLocalError('Username can only contain letters, numbers, underscores, and hyphens');
      return false;
    }

    if (!name.trim()) {
      setLocalError('Display name is required');
      return false;
    }

    if (password && password.length < 4) {
      setLocalError('Password must be at least 4 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const success = await register(handle.trim(), name.trim(), password || undefined);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--color-bg-primary)]">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Create Account
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Join SillyTavern
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-xl">
          {!canSelfRegister ? (
            <div className="text-center py-8">
              <Lock size={48} className="mx-auto text-[var(--color-text-secondary)] mb-4" />
              <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                Registration Restricted
              </h3>
              <p className="text-[var(--color-text-secondary)] mb-4">
                New user registration requires admin approval. Please contact an administrator.
              </p>
              <Link
                to="/login"
                className="text-[var(--color-primary)] hover:underline"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                <AtSign size={20} className="text-[var(--color-text-secondary)] flex-shrink-0" />
                <Input
                  type="text"
                  placeholder="Username (for login)"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  className="flex-1"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* Display Name */}
              <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                <User size={20} className="text-[var(--color-text-secondary)] flex-shrink-0" />
                <Input
                  type="text"
                  placeholder="Display Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1"
                  autoComplete="name"
                />
              </div>

              {/* Password */}
              <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                <Lock size={20} className="text-[var(--color-text-secondary)] flex-shrink-0" />
                <Input
                  type="password"
                  placeholder="Password (optional)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1"
                  autoComplete="new-password"
                />
              </div>

              {/* Confirm Password */}
              {password && (
                <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                  <Lock size={20} className="text-[var(--color-text-secondary)] flex-shrink-0" />
                  <Input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="flex-1"
                    autoComplete="new-password"
                  />
                </div>
              )}

              {/* Error Messages */}
              {(localError || error) && (
                <p className="text-red-500 text-sm text-center">
                  {localError || error}
                </p>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isLoading}
              >
                <UserPlus size={20} className="mr-2" />
                Create Account
              </Button>

              {/* Login Link */}
              <p className="text-center text-sm text-[var(--color-text-secondary)]">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-[var(--color-primary)] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[var(--color-text-secondary)] text-sm mt-6">
          Mobile-friendly React UI
        </p>
      </div>
    </div>
  );
}
