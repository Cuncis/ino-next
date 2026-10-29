import { useEffect, useRef, useState } from 'react';
import geolocationErrorMessage from './geolocationError';
import Icon from './Icon';
import SearchBar from './SearchBar';

// Wide enough to show the whole archipelago until a point is picked or a
// device fix centers the map — there's no meaningful single default city to
// zoom to for every shopper.
const DEFAULT_CENTER = { lat: -2.5, lng: 118 };
const DEFAULT_ZOOM = 5;

// Building-level, not just street-level — 16 still left shoppers unsure
// which house/shop the pin actually sat on.
const POINT_ZOOM = 18;

// Google's own usage guidance is to fire Autocomplete requests only after
// the shopper pauses typing, not on every keystroke.
const SEARCH_DEBOUNCE_MS = 700;

// Loaded once per page and reused by every mount — Google's script rejects
// being injected twice, and shoppers can open/close this modal repeatedly.
let googleMapsPromise: Promise<typeof google.maps> | null = null;

function loadGoogleMaps(): Promise<typeof google.maps> {
    if (typeof google !== 'undefined' && google.maps?.places) {
        return Promise.resolve(google.maps);
    }

    if (! googleMapsPromise) {
        googleMapsPromise = new Promise<typeof google.maps>((resolve, reject) => {
            const script = document.createElement('script');
            const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
            script.async = true;
            script.onload = () => resolve(google.maps);
            script.onerror = () => reject(new Error('load-failed'));
            document.head.appendChild(script);
        });
    }

    return googleMapsPromise;
}

/**
 * Click-to-place-a-pin location picker, opened from `AddressFields.jsx`'s
 * "Gunakan lokasi saya" button.
 *
 * Uses Google Maps (JS API + Places Autocomplete) rather than a free tile
 * provider — shoppers already know how to read a Google map, which a
 * lesser-known basemap doesn't buy back. Needs `VITE_GOOGLE_MAPS_API_KEY` set
 * (an HTTP-referrer-restricted browser key, not a secret) with the "Maps
 * JavaScript API" and "Places API" enabled and billing active on the Google
 * Cloud project.
 *
 * Browser geolocation alone (`getCurrentPosition`) is unreliable across
 * devices and browsers — permission prompts, in-app browsers, disabled OS
 * location services all fail it in ways a shopper has no fix for beyond
 * "type the address in by hand." So a point can always be placed by hand
 * here, two ways: tapping the map directly, or typing an address into the
 * search bar and picking a result (Google Places Autocomplete, restricted to
 * Indonesia). The "Lokasi saya" button is a third, one-tap shortcut that only
 * works if the device's own location fix happens to succeed.
 *
 * Confirming is a real popup (dimmed backdrop, centered card) rather than an
 * inline panel — a bottom-of-map panel styled like the rest of the sheet
 * blended in and went unnoticed, so this is deliberately unmissable.
 *
 * Renders as a popup: a centred dialog over a dimmed backdrop (full screen on
 * phones). `position: fixed` takes it out of `AddressFields`' scrolling
 * `<form>`, so it is never clipped. Clicking the backdrop, the close button or
 * pressing Escape closes it.
 *
 * The map container and the floating buttons below it are siblings with no
 * z-index of their own — a positioned element without one doesn't start a
 * new stacking context, so the map's own internal layers (tiles, markers,
 * Google's own controls, all given real z-index values by the API) leak out
 * and paint above a same-context sibling regardless of DOM order. `z-0` on
 * the map container traps its internals in their own context; `z-10` on the
 * button row then unambiguously wins against that trapped context.
 */
export default function LocationPickerModal({ open, initialLat, initialLng, onClose, onConfirm }: {
  open: boolean,
  initialLat?: number|null,
  initialLng?: number|null,
  onClose: () => void,
  onConfirm: (lat: number, lng: number) => void,
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
    const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
    const locateRequestRef = useRef(0);
    const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [locating, setLocating] = useState(false);
    const [locateError, setLocateError] = useState('');
    const [mapError, setMapError] = useState('');

    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<google.maps.places.AutocompletePrediction[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');

    const placePoint = (lat: number, lng: number) => {
        setPoint({ lat, lng });

        if (markerRef.current) {
            markerRef.current.setPosition({ lat, lng });
        } else if (mapRef.current) {
            markerRef.current = new google.maps.Marker({
                position: { lat, lng },
                map: mapRef.current,
            });
        }
    };

    // Fresh state each time the modal opens, not whatever a previous
    // open/cancel left behind, then build the map itself against the now-
    // mounted container.
    useEffect(() => {
        if (! open || ! containerRef.current) {
            return;
        }

        setConfirming(false);
        setLocating(false);
        setLocateError('');
        setMapError('');
        setQuery('');
        setSearchResults([]);
        setSearchError('');

        let cancelled = false;

        loadGoogleMaps()
            .then((maps) => {
                if (cancelled || ! containerRef.current) {
                    return;
                }

                const hasInitial = initialLat != null && initialLng != null;
                const center = hasInitial ? { lat: initialLat, lng: initialLng } : DEFAULT_CENTER;

                const map = new maps.Map(containerRef.current, {
                    center,
                    zoom: hasInitial ? POINT_ZOOM : DEFAULT_ZOOM,
                    streetViewControl: false,
                    fullscreenControl: false,
                    mapTypeControl: false,
                });

                mapRef.current = map;
                markerRef.current = null;
                autocompleteServiceRef.current = new maps.places.AutocompleteService();
                placesServiceRef.current = new maps.places.PlacesService(map);

                if (hasInitial) {
                    placePoint(initialLat, initialLng);
                } else {
                    setPoint(null);
                }

                map.addListener('click', (event: google.maps.MapMouseEvent) => {
                    if (event.latLng) {
                        placePoint(event.latLng.lat(), event.latLng.lng());
                    }
                });

                // The container can still measure as 0-height on the very
                // first paint (it just mounted this same tick) — Google Maps
                // then renders for that stale size. Nudging it to resize one
                // tick later fixes it reliably without a fragile fixed delay.
                setTimeout(() => {
                    if (cancelled) {
                        return;
                    }

                    maps.event.trigger(map, 'resize');
                    map.setCenter(center);
                }, 0);
            })
            .catch(() => {
                if (! cancelled) {
                    setMapError('Gagal memuat Google Maps. Periksa koneksi internet Anda.');
                }
            });

        return () => {
            cancelled = true;
            mapRef.current = null;
            markerRef.current = null;
            autocompleteServiceRef.current = null;
            placesServiceRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Debounced address search — skips anything under 3 characters so it
    // doesn't fire on a single keystroke, and cancels a stale in-flight
    // request/timer if the shopper keeps typing before it lands.
    useEffect(() => {
        const term = query.trim();

        if (term.length < 3) {
            setSearchResults([]);
            setSearchError('');

            return;
        }

        if (! autocompleteServiceRef.current) {
            return;
        }

        let cancelled = false;
        setSearching(true);

        const timer = setTimeout(() => {
            autocompleteServiceRef.current?.getPlacePredictions(
                { input: term, componentRestrictions: { country: 'id' } },
                (predictions, status) => {
                    if (cancelled) {
                        return;
                    }

                    const ok = status === google.maps.places.PlacesServiceStatus.OK && predictions;

                    setSearchResults(ok ? predictions : []);
                    setSearchError(ok ? '' : 'Alamat tidak ditemukan.');
                    setSearching(false);
                },
            );
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query]);

    const chooseSearchResult = (prediction: google.maps.places.AutocompletePrediction) => {
        if (! placesServiceRef.current) {
            return;
        }

        placesServiceRef.current.getDetails({ placeId: prediction.place_id, fields: ['geometry'] }, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();

                placePoint(lat, lng);
                mapRef.current?.setCenter({ lat, lng });
                mapRef.current?.setZoom(POINT_ZOOM);
            }
        });

        setSearchResults([]);
        setQuery(prediction.description);
    };

    const locateMe = () => {
        if (! navigator.geolocation) {
            setLocateError('Perangkat ini tidak mendukung deteksi lokasi.');

            return;
        }

        // Identifies this button press specifically, so a callback that
        // finally lands from an earlier, already-abandoned attempt (some
        // Android browsers keep an old request alive and can call back on
        // it late, after a newer attempt has already succeeded or failed)
        // gets ignored instead of overwriting fresher state — that stray
        // late callback landing after success is what left the error banner
        // stuck on screen even once a location had already been found.
        const requestId = ++locateRequestRef.current;

        setLocating(true);
        setLocateError('');

        const attempt = (retriesLeft: number) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (requestId !== locateRequestRef.current) {
                        return;
                    }

                    const { latitude, longitude } = position.coords;

                    placePoint(latitude, longitude);
                    mapRef.current?.setCenter({ lat: latitude, lng: longitude });
                    mapRef.current?.setZoom(POINT_ZOOM);
                    setLocateError('');
                    setLocating(false);
                },
                (error) => {
                    if (requestId !== locateRequestRef.current) {
                        return;
                    }

                    // The OS/browser location provider is often still
                    // warming up right after a request starts and fails
                    // almost instantly (well under the timeout below)
                    // rather than waiting for a fix — a plain retry a
                    // couple seconds later already works, so a few silent
                    // ones spread over several seconds clear this without
                    // bothering the shopper with an error a wait would have
                    // avoided anyway. Not worth it for a denied permission,
                    // which won't change no matter how long we wait.
                    if (retriesLeft > 0 && error.code !== error.PERMISSION_DENIED) {
                        setTimeout(() => attempt(retriesLeft - 1), 1500);

                        return;
                    }

                    setLocateError(geolocationErrorMessage(error));
                    setLocating(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
            );
        };

        attempt(3);
    };

    useEffect(() => {
        if (! open) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (! open) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-stretch justify-center bg-ink/50 sm:items-center sm:p-6"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Pilih Lokasi"
            className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-pop sm:h-[min(640px,100%)] sm:max-w-[760px] sm:rounded-[4px]"
        >
            <div className="flex h-appbar shrink-0 items-center justify-between bg-brand px-3.5 text-white">
                <span className="font-display text-sm uppercase tracking-[0.5px]">Pilih Lokasi</span>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Tutup"
                    className="flex h-9 w-9 items-center justify-center"
                >
                    <Icon name="close" size={20} />
                </button>
            </div>

            <div className="relative z-10 border-b border-line bg-white p-2.5">
                <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder="Cari alamat, jalan, atau tempat..."
                    ariaLabel="Cari alamat"
                />

                {query.trim().length >= 3 ? (
                    <div className="absolute inset-x-2.5 top-full z-10 max-h-64 overflow-y-auto border border-t-0 border-line bg-white shadow-lg">
                        {searching ? (
                            <p className="p-3 text-center text-[11px] text-faint">Mencari…</p>
                        ) : searchError ? (
                            <p className="p-3 text-center text-[11px] text-faint">{searchError}</p>
                        ) : (
                            <ul>
                                {searchResults.map((prediction) => (
                                    <li key={prediction.place_id}>
                                        <button
                                            type="button"
                                            onClick={() => chooseSearchResult(prediction)}
                                            className="flex w-full items-start gap-2 border-b border-line px-3 py-2.5 text-left last:border-b-0"
                                        >
                                            <Icon
                                                name="pin"
                                                size={14}
                                                className="mt-0.5 shrink-0 text-brand"
                                            />
                                            <span className="text-[12px] leading-snug text-ink">
                                                {prediction.description}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : null}
            </div>

            <div className="relative flex-1">
                <div ref={containerRef} className="absolute inset-0 z-0" />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-2 p-3.5">
                    {mapError || locateError ? (
                        <p className="pointer-events-auto w-full rounded-[2px] bg-white p-2.5 text-center text-[11px] text-danger shadow-sm">
                            {mapError || locateError}
                        </p>
                    ) : null}

                    <button
                        type="button"
                        onClick={locateMe}
                        disabled={locating}
                        className="pointer-events-auto flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-brand shadow-sm disabled:opacity-60"
                    >
                        <Icon name="navigation" size={16} />
                        {locating ? 'Mencari…' : 'Lokasi saya'}
                    </button>

                    <button
                        type="button"
                        onClick={() => point && setConfirming(true)}
                        disabled={! point}
                        className="pointer-events-auto flex h-12 w-full items-center justify-center bg-ink text-xs font-bold uppercase tracking-wider text-white shadow-sm disabled:opacity-40"
                    >
                        {point ? 'Gunakan Titik Ini' : 'Ketuk peta untuk memilih titik'}
                    </button>
                </div>
            </div>

            {confirming ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/50 p-6">
                    <div className="w-full max-w-[300px] rounded-[2px] bg-white p-5 shadow-xl">
                        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blush text-brand">
                            <Icon name="pin" size={22} />
                        </span>

                        <p className="mb-4 text-center text-[13px] leading-relaxed text-ink">
                            Gunakan titik ini sebagai lokasi alamat Anda?
                        </p>

                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                className="h-11 flex-1 border-2 border-ink text-[11px] font-bold uppercase tracking-wider text-ink"
                            >
                                Batal
                            </button>

                            <button
                                type="button"
                                onClick={() => point && onConfirm(point.lat, point.lng)}
                                className="flex h-11 flex-1 items-center justify-center gap-1.5 bg-brand text-[11px] font-bold uppercase tracking-wider text-white"
                            >
                                <Icon name="check" size={13} />
                                Ya, Gunakan
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
        </div>
    );
}
