'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Label } from '@radix-ui/react-label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function UserSettings() {
  const { data: session, update: updateSession } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarEnabled, setAvatarEnabled] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState('');

  // Load initial settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/users/settings');
        const data = await response.json();
        setAvatarEnabled(data.avatarEnabled);
        setAvatarPrompt(data.avatarSystemPrompt || '');
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarEnabled,
          avatarSystemPrompt: avatarPrompt,
        }),
      });

      if (!response.ok) throw new Error('Failed to save settings');
      
      toast.success('Settings saved successfully');
      updateSession(); // Refresh session data
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Avatar Bot Settings</h2>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="avatar-mode"
            checked={avatarEnabled}
            onCheckedChange={setAvatarEnabled}
          />
          <Label htmlFor="avatar-mode">
            Enable AI Avatar (responds to messages when you&apos;re offline)
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatar-prompt">Avatar Personality Prompt</Label>
          <Textarea
            id="avatar-prompt"
            placeholder="Customize how your avatar should behave and respond..."
            value={avatarPrompt}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAvatarPrompt(e.target.value)}
            className="h-32"
            disabled={!avatarEnabled}
          />
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
} 