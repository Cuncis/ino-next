import { Link, usePage } from '@/lib/inertia';
import Icon, { type IconName } from './Icon';

const tabs: { key: string; label: string; icon: IconName; route: string }[] = [
    { key: 'home', label: 'Beranda', icon: 'home', route: '/' },
    { key: 'order', label: 'Pesanan', icon: 'bagSimple', route: '/cart' },
    { key: 'wishlist', label: 'Favorit', icon: 'heart', route: '/wishlist' },
    { key: 'profile', label: 'Profil', icon: 'user', route: '/profile' },
];

/**
 * Bottom navigation shared by the four main tabs and the empty states that sit
 * inside them.
 */
export default function TabBar({ active }: { active?: 'home'|'order'|'wishlist'|'profile' }) {
    const { cartCount } = usePage().props;

    return (
        <nav className="flex h-tabbar shrink-0 items-center bg-brand shadow-[0_-2px_8px_rgba(0,0,0,.12)]">
            {tabs.map((tab) => {
                const isActive = tab.key === active;

                return (
                    <Link
                        key={tab.key}
                        href={tab.route}
                        className="flex flex-1 flex-col items-center justify-center gap-1 py-1.5"
                    >
                        <span className="relative">
                            <span
                                className={`flex h-8 min-w-8 items-center justify-center rounded-full px-3 transition-colors ${
                                    isActive ? 'bg-white text-brand' : 'text-white/55'
                                }`}
                            >
                                <Icon name={tab.icon} size={20} />
                            </span>

                            {tab.key === 'order' && (cartCount ?? 0) > 0 ? (
                                <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-danger px-[3px] text-[8px] font-bold text-white">
                                    {cartCount}
                                </span>
                            ) : null}
                        </span>

                        <span className={`text-[9px] ${isActive ? 'font-bold text-white' : 'text-white/55'}`}>
                            {tab.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
