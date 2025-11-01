import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LogOut, Search } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useBranding } from '@/hooks/use-branding';
import { logout } from '@/lib/auth';

interface HeaderProps {
  showSearch?: boolean;
  onSearchClick?: () => void;
  className?: string;
}

export default function Header({ 
  showSearch = false, 
  onSearchClick,
  className = ""
}: HeaderProps) {
  const { user } = useAuth();
  const { platformName, logoUrl } = useBranding();

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  return (
    <div className={`bg-card border-b border-border px-4 py-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Link href="/feed">
          <div className="flex items-center cursor-pointer">
            {logoUrl ? (
              <img
                src={`${logoUrl}${logoUrl.includes('?') ? '&' : '?'}_=${Date.now()}`}
                alt={`${platformName} logo`}
                className="h-8 w-auto max-w-[100px] object-contain"
                onError={(e) => {
                  // Fallback to default if image fails to load or is removed
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            {!logoUrl && (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">LR</span>
              </div>
            )}
            <span className="ml-2 text-lg font-bold text-foreground">
              {platformName}
            </span>
          </div>
        </Link>
        
        <div className="flex items-center space-x-2">
          {showSearch && (
            <Button
              onClick={onSearchClick}
              variant="outline"
              size="icon"
              className="w-8 h-8"
            >
              <Search className="w-4 h-4" />
            </Button>
          )}
          <ThemeToggle />
          {user && (
            <Button
              onClick={handleLogout}
              variant="outline"
              size="icon"
              className="w-8 h-8"
              data-testid="mobile-header-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
