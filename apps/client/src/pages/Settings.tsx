import { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

export function Settings() {
  const { user } = useAuth();
  
  // MFA State
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState((user as any)?.mfaEnabled || false);

  const startMfaSetup = async () => {
    try {
      const res = await api.post('/auth/mfa/setup');
      setMfaSecret(res.data.secret);
      setQrCode(res.data.qrCodeImage);
      setIsSettingUpMfa(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to initiate MFA setup');
    }
  };

  const verifyAndEnableMfa = async () => {
    try {
      await api.post('/auth/mfa/verify', { code: verificationCode });
      setMfaEnabled(true);
      setIsSettingUpMfa(false);
      toast.success('Multi-Factor Authentication enabled successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Invalid verification code');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Profile</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Update your personal information.
          </p>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Input label="Name" defaultValue={user?.name || ''} />
              <Input label="Email" type="email" defaultValue={user?.email || ''} />
              <div className="pt-4 flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="py-5">
          <div className="border-t border-gray-200 dark:border-gray-800" />
        </div>
      </div>

      {/* Security Section (MFA) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Security</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Protect your account with additional security measures.
          </p>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication (2FA)</h4>
                  <p className="text-sm text-gray-500">Add an extra layer of security to your account using an authenticator app.</p>
                </div>
                <div>
                  {mfaEnabled ? (
                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      Enabled
                    </span>
                  ) : (
                    <Button variant="outline" onClick={startMfaSetup} disabled={isSettingUpMfa}>
                      Enable 2FA
                    </Button>
                  )}
                </div>
              </div>

              {/* MFA Setup Wizard */}
              {isSettingUpMfa && qrCode && !mfaEnabled && (
                <div className="mt-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800/50 space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">1. Scan QR Code</h4>
                  <p className="text-sm text-gray-500">Scan this code with your authenticator app (e.g. Google Authenticator, Authy).</p>
                  <div className="flex justify-center bg-white p-4 rounded-md inline-block">
                    <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
                  </div>
                  <p className="text-xs text-gray-500">Or enter this code manually: <span className="font-mono font-bold tracking-wider">{mfaSecret}</span></p>

                  <h4 className="font-medium text-gray-900 dark:text-white pt-2">2. Verify Code</h4>
                  <p className="text-sm text-gray-500">Enter the 6-digit code generated by your app to verify setup.</p>
                  <div className="flex gap-2 max-w-xs">
                    <Input 
                      placeholder="000000" 
                      maxLength={6} 
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                    />
                    <Button onClick={verifyAndEnableMfa} disabled={verificationCode.length !== 6}>Verify</Button>
                  </div>
                  <div className="pt-2">
                    <button 
                      className="text-sm text-gray-500 hover:underline"
                      onClick={() => setIsSettingUpMfa(false)}
                    >
                      Cancel Setup
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="py-5">
          <div className="border-t border-gray-200 dark:border-gray-800" />
        </div>
      </div>

      {/* Notifications Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notifications</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure how you receive alerts.
          </p>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Email Notifications</h4>
                  <p className="text-sm text-gray-500">Receive summaries of changes directly to your inbox.</p>
                </div>
                <div className="relative inline-block w-11 h-6 align-middle select-none transition duration-200 ease-in">
                  <input type="checkbox" name="toggle" id="toggle1" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-blue-600 outline-none focus:outline-none focus:ring-0 focus:border-blue-600 transition-transform duration-200 ease-in-out translate-x-5" defaultChecked />
                  <label htmlFor="toggle1" className="toggle-label block overflow-hidden h-6 rounded-full bg-blue-600 cursor-pointer"></label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
