import { logout } from '@/services/api';
import { useAppStore } from '@/store/appStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings } from 'lucide-react';

export default function UserMenu() {
  const { userProfile } = useAppStore();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="airbnb-icon-btn flex items-center gap-2 !px-2.5 !py-1.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-brand-deep flex items-center justify-center text-white text-xs font-bold">
            {userProfile?.name ? getInitials(userProfile.name) : 'U'}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 rounded-xl p-1" align="end" forceMount>
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none">
              {userProfile?.name || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {userProfile?.email || 'user@example.com'}
            </p>
            <p className="text-xs leading-none text-muted-foreground mt-1">
              Level {userProfile?.level || 1}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => window.location.href = '/dashboard/profile'}
          className="rounded-lg py-2.5 cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-destructive rounded-lg py-2.5 cursor-pointer focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
