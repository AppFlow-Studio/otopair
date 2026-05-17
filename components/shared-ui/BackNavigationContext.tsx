import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

type BackNavigationContextValue = {
    disabled: boolean;
};

const BackNavigationContext = createContext<BackNavigationContextValue>({
    disabled: false,
});

export function BackNavigationProvider({
    children,
    disabled,
}: {
    children: ReactNode;
    disabled: boolean;
}) {
    return (
        <BackNavigationContext.Provider value={{ disabled }}>
            {children}
        </BackNavigationContext.Provider>
    );
}

export function useBackNavigationDisabled() {
    return useContext(BackNavigationContext).disabled;
}
