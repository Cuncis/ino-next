'use client';

import { Link } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Icon from '@/components/shop/Icon';
import { allScreens, screenGroups } from '@/components/shop/screens';

export default function Index() {
    return (
        <MobileLayout
            title="Daftar Halaman"
            header={<AppBar title="Halaman" tone="brand" />}
        >
            <div className="flex-1 overflow-y-auto p-3.5">
                <div className="mb-4 bg-blush p-4 text-center">
                    <div className="font-display text-lg">Pratinjau Halaman UI</div>
                    <div className="mt-1 text-xs text-muted">
                        {allScreens.length} halaman · tampilan mobile di semua perangkat
                    </div>
                </div>

                {screenGroups.map((group) => (
                    <div key={group.group} className="mb-5">
                        <div className="mb-2.5 border-b border-[#d0d5de] pb-[7px] text-[10px] font-bold uppercase tracking-[2px] text-[#888888]">
                            {group.group}
                        </div>

                        {group.screens.map((screen) => (
                            <Link
                                key={screen.slug}
                                href={`/${screen.slug}`}
                                className="mb-[7px] flex items-center gap-3 border border-line px-3.5 py-[13px]"
                            >
                                <span className="w-6 text-[11px] text-faint">
                                    {String(screen.number).padStart(2, '0')}
                                </span>

                                <span className="flex-1 text-[13px]">{screen.name}</span>

                                <Icon
                                    name="chevronRight"
                                    size={14}
                                    className="text-[#cccccc]"
                                />
                            </Link>
                        ))}
                    </div>
                ))}
            </div>
        </MobileLayout>
    );
}
