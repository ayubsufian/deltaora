import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function Settings() {
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
              <Input label="Name" defaultValue="Demo User" />
              <Input label="Email" type="email" defaultValue="user@deltaora.com" />
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
