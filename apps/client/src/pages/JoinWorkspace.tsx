import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

export function JoinWorkspace() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { isAuthenticated, setActiveWorkspaceId } = useAuth();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing invitation token.');
    }
  }, [token]);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      toast('Please log in or register first to accept this invitation', { icon: '👋' });
      navigate('/login'); // Realistically, we should save the token in session storage and redirect back, but this is fine for MVP
      return;
    }

    setIsJoining(true);
    try {
      const res = await api.post('/workspaces/join', { inviteToken: token });
      toast.success('Successfully joined the workspace!');
      
      // Automatically switch to the newly joined workspace
      if (res.data.workspaceId) {
        setActiveWorkspaceId(res.data.workspaceId);
      }
      
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join workspace. The link may have expired.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex justify-center mt-20">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Workspace Invitation</CardTitle>
          <CardDescription>
            You have been invited to join a Deltaora workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm text-center border border-red-100">
              {error}
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300">
              <p>Click below to securely accept the invitation and access the team's monitored pages and competitive intelligence.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            className="w-full" 
            onClick={handleJoin} 
            isLoading={isJoining}
            disabled={!!error}
          >
            {isAuthenticated ? 'Accept Invitation' : 'Login to Accept'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
