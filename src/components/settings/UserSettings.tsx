'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Label } from '@radix-ui/react-label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function UserSettings() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarEnabled, setAvatarEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      if (!session?.user?.id) return;

      try {
        const response = await fetch(`/api/users/${session.user.id}`);
        const data = await response.json();
        setAvatarEnabled(data.avatarEnabled);
        setVideoEnabled(data.videoEnabled);
        setSystemPrompt(data.avatarSystemPrompt || '');
        setAvatarImage(data.avatarImage || null);
      } catch (error) {
        console.error('Error fetching user settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load settings',
          variant: 'destructive',
        });
      }
    };

    fetchSettings();
  }, [session?.user?.id, toast]);

  const handleAvatarToggle = async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarEnabled: !avatarEnabled,
          // If turning off avatar, also turn off video
          videoEnabled: !avatarEnabled ? false : videoEnabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to update settings');

      setAvatarEnabled(!avatarEnabled);
      // If turning off avatar, also turn off video
      if (avatarEnabled) {
        setVideoEnabled(false);
      }
      
      toast({
        title: 'Success',
        description: `AI Avatar ${!avatarEnabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating avatar settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoToggle = async () => {
    if (!session?.user?.id || !avatarEnabled) return;

    setIsLoading(true);
    try {
      // Don't allow video without an avatar image
      if (!avatarImage && !videoEnabled) {
        toast({
          title: 'Error',
          description: 'Please upload an avatar image first',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`/api/users/${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoEnabled: !videoEnabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to update settings');

      setVideoEnabled(!videoEnabled);
      toast({
        title: 'Success',
        description: `Video responses ${!videoEnabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating video settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSystemPromptSave = async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarSystemPrompt: systemPrompt,
        }),
      });

      if (!response.ok) throw new Error('Failed to update system prompt');

      toast({
        title: 'Success',
        description: 'System prompt updated',
      });
    } catch (error) {
      console.error('Error updating system prompt:', error);
      toast({
        title: 'Error',
        description: 'Failed to update system prompt',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!session?.user?.id || !e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Only JPEG, PNG, and WebP images are supported',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/users/avatar-image', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const { avatarImage } = await uploadResponse.json();
      setAvatarImage(avatarImage);

      toast({
        title: 'Success',
        description: 'Avatar image uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading avatar image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload avatar image',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-900">
      <div className="w-full">
        <div className="border-b border-gray-800">
          <Button
            variant="ghost"
            className="text-gray-200 hover:text-white hover:bg-gray-800 m-4"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
        </div>

        <div className="px-4 py-6">
          <div className="mb-6">
            <h3 className="text-2xl font-medium text-white">AI Avatar Settings</h3>
            <p className="text-gray-400">
              Configure your AI avatar to respond on your behalf when you're offline.
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 divide-y divide-gray-700">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="avatar-toggle" className="text-white text-lg">Enable AI Avatar</Label>
                  <p className="text-gray-400 mt-1">
                    Allow the AI to respond to messages when you're offline
                  </p>
                </div>
                <Switch
                  id="avatar-toggle"
                  checked={avatarEnabled}
                  onCheckedChange={handleAvatarToggle}
                  disabled={isLoading}
                />
              </div>
            </div>

            {avatarEnabled && (
              <>
                <div className="p-6">
                  <div className="space-y-3">
                    <Label htmlFor="avatar-image" className="text-white text-lg">Avatar Image</Label>
                    <p className="text-gray-400">
                      Upload an image to represent your AI avatar (JPEG, PNG, or WebP, max 5MB)
                    </p>
                    <Input
                      id="avatar-image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarImageUpload}
                      disabled={isLoading}
                      className="bg-gray-700 text-white border-gray-600"
                    />
                    {avatarImage && (
                      <div className="mt-2">
                        <img
                          src={avatarImage}
                          alt="Avatar Preview"
                          className="w-24 h-24 rounded-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="video-toggle" className="text-white text-lg">Enable Video Responses</Label>
                      <p className="text-gray-400 mt-1">
                        Allow your AI avatar to respond with video messages
                      </p>
                    </div>
                    <Switch
                      id="video-toggle"
                      checked={videoEnabled}
                      onCheckedChange={handleVideoToggle}
                      disabled={isLoading || !avatarEnabled}
                    />
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-3">
                    <Label htmlFor="system-prompt" className="text-white text-lg">System Prompt</Label>
                    <p className="text-gray-400">
                      Customize how your AI avatar behaves and responds
                    </p>
                    <Textarea
                      id="system-prompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="min-h-[100px] bg-gray-700 text-white border-gray-600"
                      placeholder="Enter a system prompt for your AI avatar..."
                    />
                    <Button
                      onClick={handleSystemPromptSave}
                      disabled={isLoading}
                      className="mt-2 text-white"
                    >
                      Save System Prompt
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 