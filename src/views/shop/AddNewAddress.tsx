'use client';

import type { FormEvent } from 'react';
import { useForm } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AddressFields from '@/components/shop/AddressFields';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import Field from '@/components/shop/Field';

export default function AddNewAddress({ provinces }: { provinces: { code: string, name: string }[] }) {
    const { data, setData, post, processing, errors } = useForm({
        label: '',
        recipientName: '',
        phone: '',
        addressLine: '',
        kelurahan: '',
        kecamatan: '',
        kota: '',
        provinsi: '',
        postalCode: '',
        note: '',
        latitude: null,
        longitude: null,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/add-new-address');
    };

    return (
        <MobileLayout
            title="Tambah Alamat Baru"
            header={
                <AppBar title="Tambah Alamat Baru" back="/my-address" tone="brand" />
            }
        >
            <form onSubmit={submit} className="flex-1 overflow-y-auto p-4">
                <div className="mb-2.5">
                    <label htmlFor="label" className="mb-1 block text-[12px] font-medium text-ink">
                        Label Alamat
                    </label>

                    <select
                        id="label"
                        name="label"
                        value={data.label}
                        onChange={(event) => setData('label', event.target.value)}
                        className={`h-control w-full border bg-white px-3.5 text-[13px] text-muted focus:outline-hidden focus:ring-0 ${
                            errors.label ? 'border-danger' : 'border-blush'
                        }`}
                    >
                        <option value="" disabled>
                            Pilih label alamat
                        </option>
                        <option value="Rumah">Rumah</option>
                        <option value="Kos">Kos</option>
                        <option value="Kontrakan">Kontrakan</option>
                        <option value="Kantor">Kantor</option>
                    </select>

                    {errors.label ? <p className="mt-1 text-[11px] text-danger">{errors.label}</p> : null}
                </div>

                <Field
                    name="recipientName"
                    label="Nama Penerima"
                    value={data.recipientName}
                    onChange={(event) => setData('recipientName', event.target.value)}
                    placeholder="Contoh: Kirana Wijaya"
                    error={errors.recipientName}
                    className="mb-2.5"
                />

                <Field
                    name="phone"
                    label="Nomor HP Penerima"
                    value={data.phone}
                    onChange={(event) => setData('phone', event.target.value)}
                    placeholder="Contoh: 081234567890"
                    error={errors.phone}
                    className="mb-2.5"
                />

                <Field
                    name="addressLine"
                    label="Alamat Lengkap"
                    value={data.addressLine}
                    onChange={(event) => setData('addressLine', event.target.value)}
                    placeholder="Contoh: Jl. Kebon Jeruk Raya No. 27"
                    error={errors.addressLine}
                    className="mb-2.5"
                />

                <AddressFields data={data} setData={setData} errors={errors} provinces={provinces} />

                <Button type="submit" disabled={processing}>
                    {processing ? 'Menyimpan…' : 'Tambah Alamat'}
                </Button>
            </form>
        </MobileLayout>
    );
}
