import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import Icon from './Icon';

const control =
    'w-full rounded-lg border border-admin-border bg-admin-card px-3 text-[13px] text-admin-body placeholder:text-admin-muted focus:border-brand focus:outline-hidden focus:ring-0 dark:border-admin-dark-border dark:bg-admin-dark-card dark:text-admin-dark-body';

/**
 * Label + control + optional hint, the row every admin form is built from.
 */
export function Field({ label, htmlFor, hint, children, className = '' }: {
  label: string,
  htmlFor?: string,
  hint?: string,
  children: import('react').ReactNode,
  className?: string,
}) {
    return (
        <div className={className}>
            <label
                htmlFor={htmlFor}
                className="mb-1.5 block text-[13px] font-medium text-admin-heading dark:text-admin-dark-heading"
            >
                {label}
            </label>

            {children}

            {hint ? (
                <p className="mt-1 text-xs text-admin-muted dark:text-admin-dark-muted">{hint}</p>
            ) : null}
        </div>
    );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    return <input className={`h-10 ${control} ${className}`} {...rest} />;
}

export function Textarea({ rows = 4, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea rows={rows} className={`resize-none py-2.5 ${control} ${className}`} {...rest} />;
}

export function Select({ options, className = '', ...rest }: { options: (string | { value: string, label: string })[] } & SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select className={`h-10 ${control} ${className}`} {...rest}>
            {options.map((option) => {
                const value = typeof option === 'string' ? option : option.value;
                const label = typeof option === 'string' ? option : option.label;

                return (
                    <option key={value} value={value}>
                        {label}
                    </option>
                );
            })}
        </select>
    );
}

/**
 * Sliding on/off switch.
 */
export function Switch({ checked, onChange, label }: { checked: boolean, onChange: () => void, label?: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className="flex items-center gap-2.5"
        >
            <span
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    checked ? 'bg-brand' : 'bg-admin-border dark:bg-admin-dark-border'
                }`}
            >
                <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                        checked ? 'left-[18px]' : 'left-0.5'
                    }`}
                />
            </span>

            {label ? (
                <span className="text-[13px] text-admin-body dark:text-admin-dark-body">
                    {label}
                </span>
            ) : null}
        </button>
    );
}

/**
 * Dashed drop zone. Presentational only when `onFiles` is omitted — that is
 * how most screens still use it. Pass `onFiles` to turn it into a real
 * click-or-drag file picker (see `ProductImageManager`).
 */
export function DropZone({ hint = 'PNG, JPG atau PDF maksimal 5 MB', onFiles, multiple = false, accept }: { hint?: string, onFiles?: (files: File[]) => void, multiple?: boolean, accept?: string }) {
    const body = (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-admin-border px-6 py-10 text-center dark:border-admin-dark-border">
            <Icon name="solar:cloud-upload-broken" size={38} className="mb-3 text-admin-muted" />

            <p className="text-[13px] font-medium text-admin-heading dark:text-admin-dark-heading">
                Letakkan berkas di sini atau klik untuk mengunggah
            </p>
            <p className="mt-1 text-xs text-admin-muted dark:text-admin-dark-muted">{hint}</p>
        </div>
    );

    if (! onFiles) {
        return body;
    }

    const pick = (fileList: FileList | null) => {
        const files = Array.from(fileList ?? []);

        if (files.length) {
            onFiles(files);
        }
    };

    return (
        <label
            className="block cursor-pointer"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                pick(event.dataTransfer.files);
            }}
        >
            <input
                type="file"
                className="sr-only"
                multiple={multiple}
                accept={accept}
                onChange={(event) => {
                    pick(event.target.files);
                    event.target.value = '';
                }}
            />
            {body}
        </label>
    );
}
