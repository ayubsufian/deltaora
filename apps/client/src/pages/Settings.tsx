import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

interface AuditLog {
  _id: string;
  actorId: { name: string; email: string };
  action: string;
  createdAt: string;
  metadata?: any;
  ipAddress?: string;
}

export function Settings() {
  const { user, activeWorkspaceId } = useAuth();
  
  // MFA State
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState((user as any)?.mfaEnabled || false);

  // Team State
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  
  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Email Preferences State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchMembers();
      fetchAuditLogs();
    }
    fetchEmailPreferences();
  }, [activeWorkspaceId]);

  const fetchEmailPreferences = async () => {
    try {
      const res = await api.get('/users/me/preferences');
      setNotificationsEnabled(res.data.emailPreferences?.notifications ?? true);
      setMarketingEnabled(res.data.emailPreferences?.marketing ?? false);
    } catch (error) {
      // Ignore
    }
  };

  const togglePreference = async (key: 'notifications' | 'marketing', value: boolean) => {
    try {
      await api.patch('/users/me/preferences', { [key]: value });
      if (key === 'notifications') setNotificationsEnabled(value);
      if (key === 'marketing') setMarketingEnabled(value);
      toast.success('Preference updated');
    } catch (error: any) {
      toast.error('Failed to update preference');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get(`/workspaces/${activeWorkspaceId}/audit-logs`);
      setAuditLogs(res.data);
    } catch (error) {
      // Ignore if user is not owner
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await api.get(`/workspaces/${activeWorkspaceId}/members`);
      setMembers(res.data);
    } catch (error) {
      console.error('Failed to fetch members');
    }
  };

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

  const generateInviteToken = async () => {
    if (!activeWorkspaceId) return;
    setIsGeneratingInvite(true);
    try {
      const payload: any = { role: inviteRole };
      if (inviteEmail.trim()) {
        payload.email = inviteEmail.trim();
      }
      const res = await api.post(`/workspaces/${activeWorkspaceId}/invites`, payload);
      setInviteToken(res.data.inviteToken);
      if (res.data.emailSent) {
        toast.success(`Invite email sent to ${inviteEmail}`);
        setInviteEmail('');
      } else {
        toast.success('Invite link generated successfully!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate invite');
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!activeWorkspaceId) return;
    if (!confirm('Are you sure you want to remove this member?')) return;
    
    try {
      await api.delete(`/workspaces/${activeWorkspaceId}/members/${userId}`);
      toast.success('Member removed');
      fetchMembers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to remove member');
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    if (!activeWorkspaceId) return;
    
    try {
      await api.patch(`/workspaces/${activeWorkspaceId}/members/${userId}`, { role: newRole });
      toast.success('Role updated');
      fetchMembers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update role');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your account, security, and team preferences.
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

      {/* Team Settings Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Team Management</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your workspace members and roles.
          </p>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardContent className="space-y-6 pt-6">
              
              {/* Member List */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Workspace Members</h4>
                <div className="space-y-3">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-md dark:border-gray-800">
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <select 
                          value={member.role}
                          onChange={(e) => updateRole(member.id, e.target.value)}
                          className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 p-1"
                        >
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <Button 
                          variant="outline" 
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => removeMember(member.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Invite New Member</h4>
                <p className="text-sm text-gray-500 mb-4">Enter a coworker's email to send them an invite, or generate a link to share manually.</p>
                
                <div className="flex flex-col gap-3">
                  <Input
                    label="Invitee Email (optional)"
                    type="email"
                    placeholder="coworker@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <div className="flex items-end gap-3">
                    <div className="w-1/3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                      <select 
                        value={inviteRole}
                        onChange={(e: any) => setInviteRole(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-900 dark:border-gray-700 h-10 px-3 border"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <Button onClick={generateInviteToken} isLoading={isGeneratingInvite}>
                      {inviteEmail.trim() ? 'Send Invite Email' : 'Generate Invite Link'}
                    </Button>
                  </div>
                </div>

                {inviteToken && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Invite Link Generated (Valid for 48 hours):</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={`${window.location.origin}/join?token=${inviteToken}`}
                        className="w-full text-sm p-2 rounded border border-gray-300 bg-white dark:bg-gray-800" 
                      />
                      <Button onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/join?token=${inviteToken}`);
                        toast.success('Copied to clipboard');
                      }}>Copy</Button>
                    </div>
                  </div>
                )}
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

      {/* Email Preferences Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notifications</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Control which emails you receive from Deltaora.
          </p>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Page Change Alerts</h4>
                  <p className="text-sm text-gray-500">Receive emails when changes are detected on your monitored pages.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationsEnabled}
                  onClick={() => togglePreference('notifications', !notificationsEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${notificationsEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Marketing & Updates</h4>
                  <p className="text-sm text-gray-500">Receive product updates, tips, and feature announcements.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={marketingEnabled}
                  onClick={() => togglePreference('marketing', !marketingEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${marketingEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${marketingEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <p className="text-xs text-gray-400 pt-2">Security-related emails (password resets, login alerts) cannot be disabled.</p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* SOC2 Audit Logs Section - Only visible if there are logs (owner) */}
      {auditLogs.length > 0 && (
        <>
          <div className="hidden sm:block">
            <div className="py-5">
              <div className="border-t border-gray-200 dark:border-gray-800" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Audit Logs</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Security and compliance trail for this workspace.
              </p>
            </div>
            <div className="md:col-span-2">
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Actor</th>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log._id} className="border-b dark:border-gray-700">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">{log.actorId?.name || 'System'}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">{log.action}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-xs">
                              {JSON.stringify(log.metadata || {})}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
