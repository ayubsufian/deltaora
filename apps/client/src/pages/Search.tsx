import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { Search as SearchIcon } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { useSearch } from '../hooks/useApi';

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(queryFromUrl);

  const { data: results, isLoading } = useSearch(queryFromUrl);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim() });
    }
  };

  const hasResults = results && (results.urls.length > 0 || results.summaries.length > 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Search</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Search across page titles, URLs, and AI summaries.
        </p>
      </div>

      <form onSubmit={handleSearch}>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <Input
            className="pl-10 text-lg py-3"
            placeholder="Search pages, URLs, or summaries..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>
      </form>

      {!queryFromUrl ? (
        <EmptyState 
          icon={SearchIcon}
          title="Search your workspace"
          description="Search for page titles, URLs, or within AI summaries of changes."
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : hasResults ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Showing results for "{queryFromUrl}"
          </p>

          {results!.urls.map((page) => (
            <Card key={`page-${page._id}`} className="hover:border-blue-500/50 transition-colors">
              <CardContent className="p-4 flex gap-4">
                <div className="pt-1">
                  <Badge variant="default" className="uppercase">page</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-blue-600 hover:underline">
                    <Link to={`/pages/${page._id}`}>{page.title}</Link>
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{page.url}</p>
                </div>
              </CardContent>
            </Card>
          ))}

          {results!.summaries.map((summary) => (
            <Card key={`summary-${summary._id}`} className="hover:border-blue-500/50 transition-colors">
              <CardContent className="p-4 flex gap-4">
                <div className="pt-1">
                  <Badge variant="secondary" className="uppercase">summary</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {summary.summary}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No results found for "{queryFromUrl}"
        </div>
      )}
    </div>
  );
}
