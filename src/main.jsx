import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './ui/base.css'

import App from './ui/App.jsx'
import Login from './ui/Login.jsx'
import AdminLogin from './ui/AdminLogin.jsx'
import AdminServices from './ui/AdminServices.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />

        {/* только одна админ-страница */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminServices />} />

        <Route path="*" element={
          <div style={{padding:24}}>
            <h2>Страница не найдена</h2>
            <p><a href="/">На главную</a></p>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
