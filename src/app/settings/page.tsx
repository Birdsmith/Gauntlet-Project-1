'use client';

import { UserSettings } from "@/components/settings/UserSettings";

export default function SettingsPage() {
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <h1 className="mb-8 text-2xl font-bold text-white">Settings</h1>
      
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
        <UserSettings />
      </div>
    </div>
  );
} 