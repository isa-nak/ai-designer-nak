import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

function init() {
  const root = document.getElementById('root')
  if (root) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
