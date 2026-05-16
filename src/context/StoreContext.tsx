'use client';

import { createContext, useContext } from 'react';

const StoreContext = createContext('');

export const useStoreId = () => useContext(StoreContext);

export function StoreProvider({ storeId, children }: { storeId: string; children: React.ReactNode }) {
  return <StoreContext.Provider value={storeId}>{children}</StoreContext.Provider>;
}
