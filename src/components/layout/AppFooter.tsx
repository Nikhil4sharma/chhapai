import { Heart } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function AppFooter() {
  return (
    <footer className="w-full bg-background border-t border-border shadow-sm safe-area-inset-bottom relative z-30">
      <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-3 pb-safe-mobile">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
          {/* Left: Branding */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center flex-shrink-0">
              <img 
                src="/chhapai-logo.png" 
                alt="Chhapai Logo" 
                className="h-full w-full object-contain logo-dark-mode"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2">
              <span className="font-display font-bold text-sm sm:text-base text-foreground tracking-tight">
                Chhapai.com
              </span>
              <span className="hidden sm:inline text-muted-foreground text-xs">•</span>
              <span className="text-xs text-muted-foreground">Ideas Realised</span>
            </div>
          </div>

          {/* Right: Made with Love */}
          <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-muted-foreground">
            <span>Made with</span>
            <Heart className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500 fill-red-500" />
            <span>by</span>
            <span className="font-medium text-foreground">Nikhil</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

