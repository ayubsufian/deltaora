import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, ExternalLink, RefreshCw, Settings } from 'lucide-react';
import * as diff2html from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';

// Note: diff2html provides a way to render diffs beautifully in HTML
// We would pass the diff text from our backend here.

export function PageDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/pages"><ArrowLeft size={20} /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Stripe Pricing</h2>
            <Badge variant="success">ACTIVE</Badge>
          </div>
          <a href="https://stripe.com/pricing" target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:underline mt-1 w-fit">
            https://stripe.com/pricing <ExternalLink size={12} className="ml-1" />
          </a>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><RefreshCw size={16} className="mr-2" /> Force Check</Button>
          <Button variant="outline" size="icon"><Settings size={16} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Latest Change Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="warning">High Importance</Badge>
                <Badge variant="secondary">Pricing</Badge>
              </div>
              <p className="text-gray-800 dark:text-gray-200">
                The standard processing fee for international cards has been increased from 2.9% to 3.2%. The base flat fee of 30¢ remains unchanged. Additionally, a new tier for volume discounts has been introduced for merchants processing over $100k/month.
              </p>
            </div>

            <div className="mt-8">
              <h3 className="font-semibold text-lg mb-4">Content Diff</h3>
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900 p-4 font-mono text-sm">
                <div className="text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1">- International cards: 2.9% + 30¢</div>
                <div className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1">+ International cards: 3.2% + 30¢</div>
                <div className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 mt-4">+ Volume discounts available for &gt;$100k/mo. Contact sales.</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-gray-500">Check Interval</span>
                <span className="font-medium text-gray-900 dark:text-white">Every 60 minutes</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-gray-500">Last Checked</span>
                <span className="font-medium text-gray-900 dark:text-white">2 mins ago</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-gray-500">Next Check</span>
                <span className="font-medium text-gray-900 dark:text-white">In 58 mins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Snapshots</span>
                <span className="font-medium text-gray-900 dark:text-white">124</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
