import { Link } from '@/lib/inertia';
import { asset } from './data';
import CartDropdown from './CartDropdown';
import HeaderSearch from './HeaderSearch';
import Icon from './Icon';
import useShopUser from './useShopUser';

/**
 * Desktop storefront header: a thin announcement strip, the main bar (logo,
 * live search field, account, cart) and the service-notice line underneath.
 */
export default function DesktopHeader() {
    const { name, signedIn } = useShopUser();

    return (
        // `contents` so the sticky bar below sticks to the whole page, not just to this
        // header's own height.
        <header className="contents">
            <div className="sticky top-0 z-40 shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
            <div className="bg-brand text-white">
                <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-6">
                    <span className="text-[11px] font-bold">Belanja di Apotek Inofarma, Lebih Hemat Lebih Lengkap!</span>

                    <a
                        href="http://info.inofarma.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="-mr-6 flex h-9 items-center bg-success px-6 text-[11px] font-bold text-white"
                    >
                        Tentang Kami
                    </a>
                </div>
            </div>

            <div className="border-t border-white/15 bg-brand text-white">
                <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
                    <Link href="/" aria-label="Inofarma" className="shrink-0">
                        <img src={asset.logo('blue')} alt="Inofarma" className="h-8 w-auto" />
                    </Link>

                    <HeaderSearch />

                    <Link
                        href={signedIn ? '/profile' : '/signin'}
                        className="flex shrink-0 flex-col text-[13px] leading-tight"
                    >
                        <span className="text-white/70">{signedIn ? 'Halo,' : 'Masuk / Daftar'}</span>
                        <span className="font-bold">{signedIn ? name : 'Akun saya'}</span>
                    </Link>

                    <CartDropdown />
                </div>
            </div>

            </div>

            <div className="border-b border-warning/30 bg-[#FFF8E1]">
                <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2.5 text-center text-[13px] font-bold text-warning-deep">
                    <Icon name="info" size={16} className="shrink-0" />
                    <span>
                        Layanan pemesanan melalui website saat ini belum beroperasi. Kami mohon maaf atas
                        ketidaknyamanannya. Untuk info seputar Inofarma, silakan kunjungi{' '}
                        <a
                            href="http://info.inofarma.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold underline"
                        >
                            info.inofarma.com
                        </a>
                        .
                    </span>
                </p>
            </div>
        </header>
    );
}
