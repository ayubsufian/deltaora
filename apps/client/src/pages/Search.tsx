import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Search as SearchIcon } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';

export function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const results = query ? [
    { id: 1, type: 'page', title: 'Stripe Pricing', url: 'https://stripe.com/pricing', match: 'pricing' },
    { id: 2, type: 'summary', title: 'OpenAI Terms Change', snippet: '...revised the pricing structure for API calls...', pageId: '2' }
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Search Results</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {query ? `Showing results for "${query}"` : 'Enter a query to search'}
        </p>
      </div>

      {!query ? (
        <EmptyState 
          icon={SearchIcon}
          title="Search your workspace"
          description="Search for page titles, URLs, or within AI summaries of changes."
        />
      ) : results.length > 0 ? (
        <div className="space-y-4">
          {results.map((result) => (
            <Card key={`${result.type}-${result.id}`} className="hover:border-blue-500/50 transition-colors">
              <CardContent className="p-4 flex gap-4">
                <div className="pt-1">
                  <Badge variant={result.type === 'page' ? 'default' : 'secondary'} className="uppercase">
                    {result.type}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-blue-600 hover:underline">
                    <Link to={result.type === 'page' ? `/pages/${result.id}` : `/pages/${result.pageId}`}>
                      {result.title}
                    </Link>
                  </h3>
                  {result.type === 'page' ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{result.url}</p>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      <span className="font-medium text-gray-900 dark:text-white">Match snippet: </span>
                      {result.snippet}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No results found for "{query}"
        </div>
      )}
    </div>
  );
}
