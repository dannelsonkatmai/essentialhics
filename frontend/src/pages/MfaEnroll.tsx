import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Download, Copy, Check } from 'lucide-react';
import { authApi } from '../api/auth.api';

interface EnrollData {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export default function MfaEnrollPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'start' | 'scan' | 'backup'>('start');
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const startEnroll = async () => {
    setIsLoading(true);
    try {
      const { data } = await authApi.enrollMfa();
      setEnrollData(data);
      setStep('scan');
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Failed to start MFA enrollment.');
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(enrollData!.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCodes = () => {
    const content = `Essential HICS — MFA Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\n${enrollData!.backupCodes.join('\n')}\n\nKeep these codes safe. Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hics-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 mb-4">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set up two-factor authentication</h1>
        </div>

        <div className="card p-6">
          {step === 'start' && (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                Your organization requires multi-factor authentication. You'll need an authenticator app like
                Google Authenticator or Microsoft Authenticator.
              </p>
              <button onClick={startEnroll} disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Starting…' : 'Set up authenticator app'}
              </button>
            </div>
          )}

          {step === 'scan' && enrollData && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                Scan this QR code with your authenticator app, or enter the key manually.
              </p>
              <div className="flex justify-center">
                <img src={enrollData.qrCodeDataUrl} alt="MFA QR code" className="h-48 w-48 border rounded-lg p-1" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1 text-center">Manual entry key:</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  <code className="flex-1 text-xs font-mono text-gray-700 break-all">{enrollData.secret}</code>
                  <button onClick={copySecret} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button onClick={() => setStep('backup')} className="btn-primary w-full">
                I've added it — show backup codes
              </button>
            </div>
          )}

          {step === 'backup' && enrollData && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Save these backup codes somewhere safe. Each code can only be used once if you lose access to your authenticator app.
              </p>
              <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-200 rounded-md p-4">
                {enrollData.backupCodes.map((code) => (
                  <code key={code} className="text-sm font-mono text-gray-700 text-center">{code}</code>
                ))}
              </div>
              <button onClick={downloadCodes} className="btn-secondary w-full flex items-center justify-center gap-2">
                <Download className="h-4 w-4" /> Download codes
              </button>
              <button onClick={() => navigate('/admin/users')} className="btn-primary w-full">
                I've saved my codes — continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
