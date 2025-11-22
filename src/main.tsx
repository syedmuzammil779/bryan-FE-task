import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './query-client.ts'
import { ReactFlowProvider } from '@xyflow/react'

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ReactFlowProvider>
                <App />
            </ReactFlowProvider>
        </QueryClientProvider>
    </StrictMode>
);
