import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button, Input, Avatar } from '../ui';

export function LoginPage() {
  const navigate = useNavigate();
  const {
    availableUsers,
    isLoading,
    error,
    isAuthenticated,
    fetchUsers,
    login,
    clearError,
  } = useAuthStore();

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUserSelect = (handle: string) => {
    setSelectedUser(handle);
    setPassword('');
    setShowPasswordField(true);
    clearError();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const success = await login(selectedUser, password || undefined);
    if (success) {
      navigate('/');
    }
  };

  const handleQuickLogin = async (handle: string) => {
    const success = await login(handle);
    if (success) {
      navigate('/');
    } else {
      // If quick login fails, show password field
      setSelectedUser(handle);
      setShowPasswordField(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--color-bg-primary)]">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            SillyTavern
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Select a user to continue
          </p>
        </div>

        {/* User Selection */}
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-xl">
          {availableUsers.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <User size={48} className="mx-auto text-[var(--color-text-secondary)] mb-4" />
              <p className="text-[var(--color-text-secondary)]">
                No users found. Create a user in SillyTavern first.
              </p>
            </div>
          ) : (
            <>
              {/* User Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {availableUsers.map((user) => (
                  <button
                    key={user.handle}
                    onClick={() =>
                      showPasswordField
                        ? handleUserSelect(user.handle)
                        : handleQuickLogin(user.handle)
                    }
                    className={`
                      flex flex-col items-center p-4 rounded-lg transition-all
                      ${
                        selectedUser === user.handle
                          ? 'bg-[var(--color-primary)] ring-2 ring-[var(--color-primary)]'
                          : 'bg-[var(--color-bg-tertiary)] hover:bg-zinc-700'
                      }
                    `}
                  >
                    <Avatar
                      src={user.avatar ? `/api/users/avatars/${user.avatar}` : undefined}
                      size="lg"
                      className="mb-2"
                    />
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate w-full text-center">
                      {user.name || user.handle}
                    </span>
                  </button>
                ))}
              </div>

              {/* Password Form */}
              {showPasswordField && selectedUser && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                    <Lock size={20} className="text-[var(--color-text-secondary)]" />
                    <Input
                      type="password"
                      placeholder="Enter password (optional)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                  </div>

                  {error && (
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                  >
                    <LogIn size={20} className="mr-2" />
                    Sign In as {availableUsers.find((u) => u.handle === selectedUser)?.name || selectedUser}
                  </Button>
                </form>
              )}
            </>
          )}

          {isLoading && availableUsers.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
            </div>
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
