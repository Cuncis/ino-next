import MobileLayout from '@/layouts/MobileLayout';
import DesktopLayout from '@/layouts/DesktopLayout';
import AppBar from './AppBar';
import DesktopHeader from './DesktopHeader';
import useIsDesktop from './useIsDesktop';

/**
 * Shell shared by the sign-in and sign-up screens.
 *
 * On phones it is the usual blue app bar over a centred form. From the `lg`
 * breakpoint up it becomes a regular web page instead: the storefront's
 * desktop header, a centred form card with a heading, and no phone frame or
 * bottom menu.
 */
export default function AuthScreen({ title, back, onSubmit, children }: {
  title: string,
  back: string,
  onSubmit: (event: import('react').FormEvent) => void,
  children: import('react').ReactNode,
}) {
    const isDesktop = useIsDesktop();

    if (isDesktop) {
        return (
            <DesktopLayout title={title} header={<DesktopHeader />}>
                <div className="mx-auto mt-12 w-full max-w-md border border-line bg-white p-8">
                    <h1 className="mb-6 text-center font-display text-xl text-brand">{title}</h1>

                    <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col items-center">
                        {children}
                    </form>
                </div>
            </DesktopLayout>
        );
    }

    return (
        <MobileLayout title={title} header={<AppBar title={title} back={back} tone="brand" />}>
            <form
                onSubmit={onSubmit}
                autoComplete="off"
                className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-canvas px-[22px] py-6"
            >
                {children}
            </form>
        </MobileLayout>
    );
}
