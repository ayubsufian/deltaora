import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Plus, Search as SearchIcon, ExternalLink, Play, Pause, Trash2, Edit2, Globe } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPageSchema } from '@deltaora/validation';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { usePages, useCreatePage, useDeletePage, useTogglePageStatus } from '../hooks/useApi';
import { formatDateRelative } from '@deltaora/shared-utils';
import toast from 'react-hot-toast';

type CreatePageForm = z.infer<typeof createPageSchema>;

export function MonitoredPages() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: pages, isLoading } = usePages({
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
    search: searchQuery || undefined,
  });

  const createPage = useCreatePage();
  const deletePage = useDeletePage();
  const toggleStatus = useTogglePageStatus();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreatePageForm>({
    resolver: zodResolver(createPageSchema),
  });

  const onSubmit = async (data: CreatePageForm) => {
    try {
      await createPage.mutateAsync(data);
      toast.success('Page added successfully');
      setIsAddModalOpen(false);
      reset();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add page');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deletePage.mutateAsync(id);
      toast.success('Page deleted');
    } catch {
      toast.error('Failed to delete page');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await toggleStatus.mutateAsync({ id, status: newStatus });
      toast.success(`Page ${newStatus === 'active' ? 'resumed' : 'paused'}`);
    } catch {
      toast.error('Failed to update status');
    }
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
            <Input
              className="pl-10"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select 
              options={[
                { label: 'All Categories', value: '' },
                { label: 'General', value: 'general' },
                { label: 'Pricing', value: 'pricing' },
                { label: 'Policy', value: 'policy' },
                { label: 'Product', value: 'product' },
                { label: 'Careers', value: 'careers' },
              ]} 
              className="w-40"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <Select 
              options={[
                { label: 'All Status', value: '' },
                { label: 'Active', value: 'active' },
                { label: 'Paused', value: 'paused' },
              ]} 
              className="w-32"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={32} />
          </div>
        ) : !pages || pages.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={Globe}
              title="No monitored pages"
              description="Add your first URL to start tracking changes."
            />
          </div>
        ) : (
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
                {pages.map((page) => (
                  <tr key={page._id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <Link to={`/pages/${page._id}`} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
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
                      <Badge variant={page.status === 'active' ? 'success' : 'warning'} className="uppercase">{page.status}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {page.lastChecked ? formatDateRelative(new Date(page.lastChecked)) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/pages/${page._id}`}>
                          <Button variant="ghost" size="icon" title="View details">
                             <Edit2 size={16} />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={page.status === 'active' ? 'Pause' : 'Resume'}
                          onClick={() => handleToggleStatus(page._id, page.status)}
                        >
                          {page.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleDelete(page._id, page.title)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <Button type="submit" isLoading={createPage.isPending}>Add Page</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
