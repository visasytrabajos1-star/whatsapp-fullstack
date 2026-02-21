import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log("🚀 [ALEX IO] System Boot: main.jsx initiated");

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("❌ [ALEX IO] FATAL: Root element not found in DOM");
    alert("Error de sistema: No se encontró el elemento raíz.");
  } else {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    console.log("✅ [ALEX IO] Virtual DOM Mount requested");
  }
} catch (bootError) {
  console.error("❌ [ALEX IO] FATAL BOOT ERROR:", bootError);
  document.body.innerHTML = `<div style="color:white; background:black; padding:20px;"><h1>ERROR DE ARRANQUE</h1><p>${bootError.message}</p></div>`;
}
