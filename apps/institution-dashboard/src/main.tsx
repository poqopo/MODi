import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DAppKitProvider } from '@mysten/dapp-kit-react'

import './index.css'
import App from './App.tsx'
import { dAppKit } from '@/lib/suiDappKit'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DAppKitProvider dAppKit={dAppKit}>
      <App />
    </DAppKitProvider>
  </StrictMode>,
)
