/**
 * Remembers where the shopper is (POST /lokasi) so branches can be sorted and
 * shown with an estimated distance. The point comes from the device, a pinned
 * spot, or a postal code looked up with {@link pointForPostalCode}.
 */
export async function saveShopperLocation(lat: number, lng: number): Promise<void> {
    await fetch('/lokasi', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? ''),
        },
        body: JSON.stringify({ lat, lng }),
    });
}

/** @returns null when the postal code is unknown */
export async function pointForPostalCode(postalCode: string): Promise<{ lat: number; lng: number } | null> {
    const response = await fetch(`/api/lokasi/kode-pos?kode=${postalCode}`, { headers: { Accept: 'application/json' } });

    if (response.status === 404) {
        return null;
    }

    if (! response.ok) {
        throw new Error('gagal');
    }

    return response.json();
}
