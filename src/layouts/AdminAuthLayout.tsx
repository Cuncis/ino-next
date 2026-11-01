import { Head, Link } from '@/lib/inertia';

/**
 * Standalone shell for the admin screens that sit outside the app chrome —
 * sign in, sign up, password reset, lock screen and the error pages.
 */
export default function AdminAuthLayout({
    title,
    children,
    heading,
    subheading,
    width = 'max-w-md',
}: {
  title: string,
  children: import('react').ReactNode,
  heading?: string,
  subheading?: string,
  width?: string,
}) {
    return (
        <>
            <Head title={title} />

            <div className="flex min-h-screen flex-col items-center justify-center bg-admin-bg px-4 py-10 dark:bg-admin-dark-bg">
                <div
                    className={`w-full ${width} rounded-[2px] border border-admin-border bg-admin-card p-7 shadow-card dark:border-admin-dark-border dark:bg-admin-dark-card`}
                >
                    <Link href="/admin" className="mb-6 flex justify-center">
                        <img
                            src="https://storage.googleapis.com/swipe-rx-ecommerce-prod/media/ino-admin-onz0i.png"
                            alt="Inofarma"
                            className="h-12 w-auto"
                        />
                    </Link>

                    {heading ? (
                        <div className="mb-6 text-center">
                            <h1 className="text-lg font-semibold text-admin-heading dark:text-admin-dark-heading">
                                {heading}
                            </h1>

                            {subheading ? (
                                <p className="mt-1.5 text-[13px] text-admin-muted dark:text-admin-dark-muted">
                                    {subheading}
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    {children}
                </div>
            </div>
        </>
    );
}
