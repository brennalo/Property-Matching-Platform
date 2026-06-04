import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// TypeScript may complain about missing type declarations for CSS imports.
// Tell TS to ignore the next line which imports the stylesheet for side effects.
// @ts-ignore
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
