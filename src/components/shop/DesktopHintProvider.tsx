'use client';

import type { ReactNode } from 'react';
import { DesktopHintContext } from './useIsDesktop';

export default function DesktopHintProvider({ isDesktop, children }: { isDesktop: boolean; children: ReactNode }) {
    return <DesktopHintContext.Provider value={isDesktop}>{children}</DesktopHintContext.Provider>;
}
