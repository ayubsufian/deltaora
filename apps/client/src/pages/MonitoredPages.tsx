import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Plus, Search as SearchIcon, ExternalLink, Play, Pause, Trash2, Edit2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPageSchema } from '@deltaora/validation';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

type CreatePageForm = z.infer<typeof createPageSchema>;

const mockPages = [
  { id: '1', title: 'Stripe Pricing', url: 'https://stripe.com/pricing', category: 'pricing', status: 'ACTIVE', lastChecked: new Date() },
  { id: '2', title: 'OpenAI Terms', url: 'https://openai.com/policies', category: 'policy', status: 'PAUSED', lastChecked: new Date(Date.now() - 86400000) },
];

export function MonitoredPages() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<CreatePageForm>({
    resolver: zodResolver(createPageSchema),
  });

  const onSubmit = (data: CreatePageForm) => {
    toast.success('Page added successfully');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Monitored Pages</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage the URLs you are tracking for changes.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} className="mr-2" /> Add URL
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input className="pl-10" placeholder="Search pages..." />
          </div>
          <div className="flex gap-2">
            <Select 
              options={[
                { label: 'All Categories', value: '' },
                { label: 'Pricing', value: 'pricing' },
                { label: 'Policy', value: 'policy' }
              ]} 
              className="w-40" 
            />
            <Select 
              options={[
                { label: 'All Status', value: '' },
                { label: 'Active', value: 'ACTIVE' },
                { label: 'Paused', value: 'PAUSED' }
              ]} 
              className="w-32" 
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-6 py-4 font-medium">Page Title / URL</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Last Checked</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockPages.map((page) => (
                <tr key={page.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <Link to={`/pages/${page.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                        {page.title}
                      </Link>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <a href={page.url} target="_blank" rel="noopener noreferrer" className="flex items-center hover:underline">
                          {page.url} <ExternalLink size={10} className="ml-1" />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className="capitalize">{page.category}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={page.status === 'ACTIVE' ? 'success' : 'warning'}>{page.status}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {page.lastChecked.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" title="View details" asChild>
                        <Link to={`/pages/${page.id}`}>
                           <Edit2 size={16} />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" title={page.status === 'ACTIVE' ? 'Pause' : 'Resume'}>
                        {page.status === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Monitored Page" description="Enter the URL and configuration for the page you want to track.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Title" placeholder="e.g. Stripe Pricing Page" {...register('title')} error={errors.title?.message} />
          <Input label="URL" type="url" placeholder="https://example.com" {...register('url')} error={errors.url?.message} />
          
          <Select 
            label="Category" 
            options={[
              { label: 'General', value: 'general' },
              { label: 'Pricing', value: 'pricing' },
              { label: 'Policy', value: 'policy' },
              { label: 'Product', value: 'product' },
              { label: 'Careers', value: 'careers' },
            ]} 
            {...register('category')}
            error={errors.category?.message}
          />
          
          <Input label="Check Interval (minutes)" type="number" defaultValue={60} {...register('checkInterval', { valueAsNumber: true })} error={errors.checkInterval?.message} />
          
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="submit">Add Page</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
