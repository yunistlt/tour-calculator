import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import App from './ui/App.jsx'
import Login from './ui/Login.jsx'
import AdminLogin from './ui/AdminLogin.jsx'
import AdminPanel from './ui/AdminPanel.jsx'
import './ui/base.css'

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/" element={<App />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<Root />)
