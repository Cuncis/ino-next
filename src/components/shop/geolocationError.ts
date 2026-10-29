/**
 * Turns a `GeolocationPositionError` into an accurate Indonesian message,
 * shared by every screen that calls `navigator.geolocation` (see
 * `useLocationConsent.js`) — a single generic "couldn't get location"
 * message regardless of cause was misleading: permission denied, no
 * location provider on the device, and a timeout each need a different fix
 * from the shopper (or aren't fixable by them at all).
 */
export default function geolocationErrorMessage(error: GeolocationPositionError) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return 'Izin lokasi ditolak. Aktifkan izin lokasi untuk browser ini di pengaturan perangkat, lalu coba lagi.';
        case error.POSITION_UNAVAILABLE:
            return 'Lokasi tidak tersedia di perangkat ini. Isi alamat secara manual.';
        case error.TIMEOUT:
            return 'Permintaan lokasi memakan waktu terlalu lama. Coba lagi.';
        default:
            return 'Tidak bisa mengambil lokasi. Isi alamat secara manual.';
    }
}
