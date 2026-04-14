import React from 'react'
import ReactDOM from 'react-dom/client'
import CentralApp from './CentralApp.jsx' // Note que aqui importa o CentralApp e não o App normal
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CentralApp />
  </React.StrictMode>,
)
