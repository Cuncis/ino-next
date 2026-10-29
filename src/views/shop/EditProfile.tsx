'use client';

import type { FormEvent } from 'react';
import { Link, router } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import Field from '@/components/shop/Field';
import Icon from '@/components/shop/Icon';
import UserAvatar from '@/components/shop/UserAvatar';
import useShopUser from '@/components/shop/useShopUser';

export default function EditProfile({ addresses }: { addresses: SavedAddress[] }) {
    const user = useShopUser();
    const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.visit('/profile');
    };

    return (
        <MobileLayout
            title="Ubah Profil"
            header={<AppBar title="Ubah Profil" back="/profile" tone="brand" />}
        >
            <form
                onSubmit={submit}
                className="flex flex-1 flex-col items-center overflow-y-auto bg-canvas px-[22px] py-[18px]"
            >
                <div className="mx-auto mb-[18px] mt-3.5 h-[108px] w-[108px] overflow-hidden rounded-full border-2 border-[#1773b0]">
                    <UserAvatar label={user.name} />
                </div>

                <div className="w-full">
                    <Field
                        type="email"
                        name="email"
                        label="Email"
                        defaultValue={user.email}
                        autoComplete="off"
                        className="mb-2.5"
                    />
                    <Field
                        type="password"
                        name="password"
                        label="Kata Sandi Baru"
                        placeholder="••••••••"
                        autoComplete="off"
                        className="mb-2.5"
                    />
                    <Field
                        type="tel"
                        name="phone"
                        label="Nomor Telepon"
                        defaultValue={user.phone}
                        autoComplete="off"
                        className="mb-3.5"
                    />

                    <label className="mb-1 block text-[12px] font-medium text-ink">
                        Alamat Pengiriman
                    </label>

                    {defaultAddress ? (
                        <Link
                            href="/my-address"
                            className="mb-2.5 flex items-start gap-2.5 border border-line bg-white p-3.5"
                        >
                            <Icon name="pin" size={19} className="mt-0.5 text-ink" />

                            <div className="flex-1">
                                <div className="mb-0.5 flex items-center gap-1.5 text-[13px] font-bold text-ink">
                                    {defaultAddress.label}
                                    {addresses.length > 1 ? (
                                        <span className="text-[11px] font-normal text-muted">
                                            +{addresses.length - 1} alamat lain
                                        </span>
                                    ) : null}
                                </div>
                                <div className="text-xs text-muted">{defaultAddress.fullAddress}</div>
                                <div className="mt-1 text-[11px] text-brand">Kelola alamat</div>
                            </div>

                            <Icon name="chevronRight" size={14} className="mt-1 text-[#cccccc]" />
                        </Link>
                    ) : (
                        <Link
                            href="/add-new-address"
                            className="mb-2.5 flex items-center gap-2.5 border border-dashed border-[#cccccc] bg-white p-3.5 text-[13px] text-brand"
                        >
                            <Icon name="plus" size={16} />
                            Tambah alamat pengiriman
                        </Link>
                    )}

                    <Button type="submit">Simpan Perubahan</Button>
                </div>
            </form>
        </MobileLayout>
    );
}
